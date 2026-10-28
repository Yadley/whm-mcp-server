require('dotenv').config();
const dns = require('dns').promises;
const WHMService = require('../src/services/whm.service');

const SERVER_IP = process.env.WHM_SERVER || '66.29.147.164';

// Authorized Nameserver List
const VALID_NAMESERVERS = [
  'ns1.creativeyadley.com',
  'ns2.creativeyadley.com',
  'bruce.ns.cloudflare.com',
  'elinore.ns.cloudflare.com',
  'jewel.ns.cloudflare.com',
  'scott.ns.cloudflare.com'
];

// Configure public DNS resolvers (Cloudflare & Google) to bypass local DNS caching
const resolver = new dns.Resolver();
resolver.setServers(['1.1.1.1', '8.8.8.8']);

async function auditDomain(domain, user, assignedIp) {
  const result = {
    user,
    domain,
    status: 'UNKNOWN',
    ns: [],
    ips: [],
    details: ''
  };

  try {
    // 1. Authoritative Nameserver Check
    try {
      const rawNs = await resolver.resolveNs(domain);
      result.ns = rawNs.map(ns => ns.toLowerCase().replace(/\.$/, ''));
    } catch (e) {
      if (e.code === 'ENODATA' || e.code === 'ENOTFOUND' || e.code === 'ESERVFAIL') {
        result.status = 'DEAD_OR_EXPIRED';
        result.details = 'No active NS records found at public DNS';
        return result;
      }
    }

    // 2. A-Record Resolution (Root domain and www fallback)
    try {
      result.ips = await resolver.resolve4(domain);
    } catch (e) {
      result.ips = [];
    }

    if (result.ips.length === 0) {
      try {
        result.ips = await resolver.resolve4('www.' + domain);
      } catch (e) {}
    }

    const targetIp = assignedIp || SERVER_IP;
    const pointsToOurServer = result.ips.includes(targetIp);

    // Check if any returned nameserver matches our authorized nameserver list
    let hasOurNS = false;
    let isOurCloudflare = false;

    for (const ns of result.ns) {
      for (const valid of VALID_NAMESERVERS) {
        if (ns === valid || ns.endsWith('.' + valid)) {
          hasOurNS = true;
          if (valid.includes('cloudflare.com')) {
            isOurCloudflare = true;
          }
          break;
        }
      }
      if (hasOurNS) break;
    }

    if (hasOurNS) {
      if (isOurCloudflare) {
        // Active in Creative Yadley Cloudflare account
        result.status = 'ACTIVE';
        result.details = `Active on Creative Yadley Cloudflare (${result.ns.slice(0, 2).join(', ')})`;
        return result;
      }

      // ns1/ns2.creativeyadley.com
      if (pointsToOurServer) {
        result.status = 'ACTIVE';
        result.details = `Points directly to Server 2 (${targetIp}) via our NS`;
        return result;
      }

      if (result.ips.length > 0) {
        result.status = 'A_RECORD_MIGRATED';
        result.details = `NS is Creative Yadley, but A record points to: ${result.ips.join(', ')}`;
        return result;
      }

      result.status = 'ACTIVE_NO_A_RECORD';
      result.details = 'NS is Creative Yadley (no A record returned)';
      return result;
    }

    // EXTERNAL NAMESERVERS (e.g. GoDaddy, Wix, Bluehost, NameBright)
    // Check if client is using our hosting via an A-record pointing to 66.29.147.164
    if (pointsToOurServer) {
      result.status = 'ACTIVE';
      result.details = `Active via External DNS (${result.ns.slice(0, 2).join(', ')}) pointing to Server 2 (${targetIp})`;
      return result;
    }

    if (result.ips.length > 0) {
      result.status = 'MIGRATED_AWAY';
      result.details = `External NS (${result.ns.slice(0, 2).join(', ')}) and A record points to: ${result.ips.join(', ')}`;
      return result;
    }

    result.status = 'MIGRATED_AWAY';
    result.details = `External NS (${result.ns.slice(0, 2).join(', ')}) with no A record pointing to Server 2`;
    return result;

  } catch (err) {
    result.status = 'ERROR';
    result.details = err.message;
    return result;
  }
}

async function main() {
  console.log('====================================================');
  console.log('Creative Yadley - Server 2 Migration Scanner (CLI)');
  console.log('====================================================');
  console.log('Fetching accounts from WHM Server (' + SERVER_IP + ')...');

  const whm = new WHMService();
  let accounts = [];
  try {
    const res = await whm.listAccounts();
    accounts = res.data?.acct || res.acct || [];
  } catch (err) {
    console.error('Failed to fetch accounts from WHM API:', err.message);
    process.exit(1);
  }

  console.log(`Found ${accounts.length} accounts on Server 2. Auditing DNS in parallel...\n`);

  const results = [];
  const batchSize = 10;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    const batchPromises = batch.map(a => auditDomain(a.domain, a.user, a.ip));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    process.stdout.write(`Audited ${results.length}/${accounts.length} domains...\r`);
  }
  console.log(`\nCompleted audit for ${results.length} domains.\n`);

  // Group by status
  const migrated = results.filter(r => r.status === 'MIGRATED_AWAY' || r.status === 'A_RECORD_MIGRATED');
  const dead = results.filter(r => r.status === 'DEAD_OR_EXPIRED');
  const active = results.filter(r => r.status === 'ACTIVE');
  const other = results.filter(r => r.status !== 'ACTIVE' && r.status !== 'MIGRATED_AWAY' && r.status !== 'A_RECORD_MIGRATED' && r.status !== 'DEAD_OR_EXPIRED');

  console.log('====================================================');
  console.log(`🚨 MIGRATED AWAY (${migrated.length})`);
  console.log('====================================================');
  if (migrated.length === 0) {
    console.log('None! All audited accounts are either active or using valid nameservers/A-records.');
  } else {
    migrated.forEach(r => {
      console.log(`• [${r.user}] ${r.domain}`);
      console.log(`    ↳ ${r.details}`);
    });
  }

  console.log('\n====================================================');
  console.log(`⚪ DEAD / EXPIRED DOMAINS (${dead.length})`);
  console.log('====================================================');
  dead.forEach(r => console.log(`• [${r.user}] ${r.domain} (${r.details})`));

  console.log('\n====================================================');
  console.log(`✅ ACTIVE ON SERVER 2 / CLOUDFLARE (${active.length})`);
  console.log('====================================================');
  active.forEach(r => {
    console.log(`• [${r.user}] ${r.domain}`);
    console.log(`    ↳ ${r.details}`);
  });

  if (other.length > 0) {
    console.log('\n====================================================');
    console.log(`⚠️ OTHER STATUS (${other.length})`);
    console.log('====================================================');
    other.forEach(r => console.log(`• [${r.user}] ${r.domain} [${r.status}] -> ${r.details}`));
  }

  console.log('\n====================================================');
  console.log('Audit Summary:');
  console.log(`Total: ${results.length} | Active: ${active.length} | Migrated Away: ${migrated.length} | Dead/Expired: ${dead.length}`);
  console.log('====================================================');
}

main().catch(console.error);
