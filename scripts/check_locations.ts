import { OAuthTokenManager } from '../server/deliverect/OAuthTokenManager.ts';

async function run() {
  const tokenManager = OAuthTokenManager.getInstance('brand-alpha', { environment: 'staging' });
  const token = await tokenManager.getAccessToken();
  console.log('Got token:', token.substring(0, 15) + '...');

  // 1. Fetch locations:
  const accountId = '68517fde1c3ddaa7f6d0275c';
  const locUrl = `https://api.staging.deliverect.com/locations?where={"account":"${accountId}"}`;
  const locRes = await fetch(locUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Locations HTTP:', locRes.status);
  const locJson = await locRes.json();
  const locations = Array.isArray(locJson) ? locJson : (locJson._items || locJson.items || []);
  console.log(`\n=== Found ${locations.length} Physical Locations ===`);
  for (const loc of locations) {
    console.log('--- Physical Location ---');
    console.log('  _id / id:', loc._id || loc.id);
    console.log('  name:', loc.name);
    console.log('  channelLinks:', JSON.stringify(loc.channelLinks));
    console.log('  address:', JSON.stringify(loc.address));
    console.log('  coordinates:', JSON.stringify(loc.coordinates));
    console.log('  status:', loc.status);
  }

  // 2. Fetch channel links:
  const clUrl = `https://api.staging.deliverect.com/channelLinks?where={"account":"${accountId}"}`;
  const clRes = await fetch(clUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('\n=== Channel Links HTTP: ' + clRes.status + ' ===');
  const clJson = await clRes.json();
  const clList = Array.isArray(clJson) ? clJson : (clJson._items || clJson.items || []);
  console.log(`Found ${clList.length} Channel Links:`);
  for (const cl of clList) {
    console.log('--- Channel Link ---');
    console.log('  _id / id:', cl._id || cl.id);
    console.log('  name:', cl.name);
    console.log('  channel / channelId:', cl.channel, cl.channelId);
    console.log('  channelCategory:', cl.channelCategory);
    console.log('  channelType:', cl.channelType);
    console.log('  location / locationId:', cl.location, cl.locationId);
    console.log('  status:', cl.status);
    console.log('  active:', cl.active);
    console.log('  menus:', JSON.stringify(cl.menus || cl.subChannels || []));
  }
}

run().catch(console.error);
