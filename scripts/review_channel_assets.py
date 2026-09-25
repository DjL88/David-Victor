"""Bounded, unauthenticated public-brand asset review. Never modifies app/runtime data.
Candidates are not approved assets. Review provenance and usage permission before shipping.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlsplit
import hashlib
import json
import re
import time

ROOT = Path('channel-asset-review')
ROOT.mkdir(exist_ok=True)
PAGES = {
 'deliveroo': 'https://merchants.deliveroo.com/',
 'deliveroo-careers': 'https://careers.deliveroo.co.uk/',
 'doordash': 'https://about.doordash.com/en-us',
 'just-eat': 'https://www.just-eat.co.uk/',
 'thuisbezorgd': 'https://www.thuisbezorgd.nl/',
 'lieferando': 'https://www.lieferando.de/',
 'takeaway': 'https://www.takeaway.com/be-en/',
 'jet-press': 'https://newsroom.justeattakeaway.com/en-WW/assets/233818/',
 'jet-uk': 'https://newsroom.justeattakeaway.com/en-GB/',
 'grubhub': 'https://www.grubhub.com/',
 'grubhub-media': 'https://about.wonder.com/overview/default.aspx',
 'uber-eats': 'https://www.ubereats.com/gb',
 'uber-merchant': 'https://merchants.ubereats.com/us/en/resources/',
 'uber-direct': 'https://merchants.ubereats.com/us/en/services/uber-direct/',
 'glovo': 'https://about.glovoapp.com/press/',
 'wolt': 'https://press.wolt.com/en-WW/assets/225299/',
 'snappy-shopper': 'https://www.snappyshopper.co.uk/',
 'snappy-retailers': 'https://retailers.snappyshopper.co.uk/',
}
MAX_BYTES = 4000000
HEADERS = {'User-Agent': 'David-Victor-Brand-Asset-Review/1.0', 'Accept': 'text/html,image/svg+xml,image/png,image/jpeg,*/*;q=0.5'}

def download(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.username or parts.password:
        raise ValueError('Only unauthenticated HTTPS public sources are accepted')
    with urlopen(Request(url, headers=HEADERS), timeout=18) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError('Source exceeds bounded download limit')
        return data, response.headers.get_content_type(), response.url

class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.candidates = []
    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        descriptor = ' '.join(str(attrs.get(k, '')) for k in ('src', 'href', 'alt', 'class', 'id', 'rel'))
        if tag == 'img' and re.search(r'logo|wordmark|brandmark', descriptor, re.I):
            self.candidates.append((attrs.get('src', ''), descriptor[:500]))
        if tag == 'link' and 'icon' in attrs.get('rel', ''):
            self.candidates.append((attrs.get('href', ''), descriptor[:500]))

def inspect(item):
    key, page = item
    folder = ROOT / key
    folder.mkdir(exist_ok=True)
    result = {'id': key, 'page': page, 'assets': []}
    try:
        raw, content_type, final_url = download(page)
        if content_type != 'text/html':
            raise ValueError('Expected a public HTML page')
        text = raw.decode('utf-8', errors='replace')
        (folder / 'source.html').write_text(text)
        result['resolvedPage'] = final_url
        parser = Images()
        parser.feed(text)
        # Inline logo geometry can be inspected without executing site JavaScript.
        for index, match in enumerate(list(re.finditer(r'<svg\b[\s\S]*?</svg>', text, re.I))[:24]):
            svg = match.group(0)
            path = folder / f'inline-{index}.svg'
            path.write_text(svg)
            result['assets'].append({'path': str(path), 'inline': True, 'context': text[max(0, match.start()-160):match.start()][:160]})
        seen = set()
        for index, (src, description) in enumerate(parser.candidates[:12]):
            if not src or src.startswith('data:'):
                continue
            url = urljoin(final_url, src)
            if url in seen:
                continue
            seen.add(url)
            entry = {'url': url, 'description': description}
            try:
                data, mime, resolved = download(url)
                extension = {'image/svg+xml': '.svg', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico'}.get(mime)
                if not extension:
                    raise ValueError('Not a supported image: ' + mime)
                path = folder / f'image-{index}{extension}'
                path.write_bytes(data)
                entry.update(path=str(path), mime=mime, resolvedUrl=resolved, sha256=hashlib.sha256(data).hexdigest())
            except Exception as error:
                entry['error'] = str(error)[:250]
            result['assets'].append(entry)
    except Exception as error:
        result['error'] = str(error)[:250]
    return result

with ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(inspect, PAGES.items()))
(ROOT / 'manifest.json').write_text(json.dumps({'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'unreviewed-public-candidates', 'sources': results}, indent=2))
for result in results:
    print(result['id'], result.get('error', ''), [(entry.get('path'), entry.get('description', '')[:100]) for entry in result['assets']])
