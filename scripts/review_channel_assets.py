"""Temporary bounded, unauthenticated public-brand asset review. No production writes.
Candidates require visual/provenance/usage review. This tool will be removed from the PR.
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
 'deliveroo-developers': 'https://developers.deliveroo.com/',
 'deliveroo-docs': 'https://api-docs.deliveroo.com/',
 'jet-uk-logos': 'https://newsroom.justeattakeaway.com/en-GB/assets/227914/',
 'jet-nl-logos': 'https://newsroom.justeattakeaway.com/nl-NL/assets/229376/',
 'jet-de-logos': 'https://newsroom.justeattakeaway.com/de-DE/assets/227955/',
 'jet-be-logos': 'https://newsroom.justeattakeaway.com/nl-BE/assets/236421/',
 'jet-go-docs': 'https://developers.just-eat.com/documentation/jet-go',
 'jet-go-news': 'https://newsroom.justeattakeaway.com/en-WW/257475-just-eat-go-to-boost-tesco-whoosh-across-the-uk/',
 'uber-comarketing': 'https://merchants.ubereats.com/us/en/resources/learning-center/co-marketing-tools/',
 'uber-direct-page': 'https://merchants.ubereats.com/us/en/services/uber-direct/',
 'grubhub-logos': 'https://about.wonder.com/media-center/',
}
DIRECT = {
 'glovo-kit': 'https://glovo-about.cdn.prismic.io/glovo-about/65cce5649be9a5b998b5d1d6_GLOVOLOGOS.zip',
 'uber-product-1': 'https://tb-static.uber.com/prod/udam-assets/7e6c6f86-26ed-4470-b0a1-bc6f7a768cf0.svg',
 'uber-product-2': 'https://tb-static.uber.com/prod/udam-assets/ca7794c1-5db6-4349-9873-b62459169beb.svg',
 'uber-product-3': 'https://tb-static.uber.com/prod/udam-assets/c5a4f5c2-d8cc-49c0-b59d-dff81bde7f6e.svg',
}
MAX_BYTES = 12000000
HEADERS = {'User-Agent': 'David-Victor-Brand-Asset-Review/1.0', 'Accept': 'text/html,image/svg+xml,image/png,image/jpeg,*/*;q=0.5'}
EXT = {'image/svg+xml': '.svg', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico', 'application/zip': '.zip', 'application/x-zip-compressed': '.zip'}

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
        self.icons = []
    def handle_starttag(self, tag, pairs):
        a = dict(pairs)
        src = a.get('src', a.get('href', ''))
        desc = ' '.join(str(a.get(k, '')) for k in ('src', 'href', 'alt', 'class', 'id', 'rel'))
        if tag == 'img' and re.search(r'logo|wordmark|brandmark|app.icon|uber|direct', desc, re.I):
            self.candidates.append((src, desc[:500]))
        if tag == 'a' and re.search(r'logo|wordmark', src, re.I) and re.search(r'\.(png|svg|jpg)(\?|$)', src, re.I):
            self.candidates.insert(0, (src, desc[:500]))
        if tag == 'link' and 'icon' in a.get('rel', ''):
            self.icons.append((src, desc[:500]))

def store_image(folder, index, url, desc):
    entry = {'url': url, 'description': desc}
    try:
        data, mime, resolved = download(url)
        extension = EXT.get(mime)
        if not extension and data[:4] == b'PK\x03\x04':
            extension = '.zip'
        if not extension:
            raise ValueError('Unsupported image/archive MIME: ' + mime)
        path = folder / f'image-{index}{extension}'
        path.write_bytes(data)
        entry.update(path=str(path), mime=mime, resolvedUrl=resolved, sha256=hashlib.sha256(data).hexdigest())
    except Exception as error:
        entry['error'] = str(error)[:250]
    return entry

def inspect(item):
    key, page = item
    folder = ROOT / key
    folder.mkdir(exist_ok=True)
    result = {'id': key, 'page': page, 'assets': []}
    try:
        if key in DIRECT:
            result['assets'].append(store_image(folder, 0, page, 'Explicit linked official asset; review required'))
            return result
        raw, mime, final_url = download(page)
        if mime != 'text/html':
            raise ValueError('Expected public HTML')
        text = raw.decode('utf-8', errors='replace')
        (folder / 'source.html').write_text(text)
        result['resolvedPage'] = final_url
        parser = Images()
        parser.feed(text)
        for index, match in enumerate(list(re.finditer(r'<svg\b[\s\S]*?</svg>', text, re.I))[:18]):
            path = folder / f'inline-{index}.svg'
            path.write_text(match.group(0))
            result['assets'].append({'path': str(path), 'inline': True, 'context': text[max(0,match.start()-160):match.start()]})
        seen = set()
        for index, (src, desc) in enumerate((parser.candidates + parser.icons)[:28]):
            if not src or src.startswith('data:'):
                continue
            url = urljoin(final_url, src)
            if url in seen:
                continue
            seen.add(url)
            result['assets'].append(store_image(folder, index, url, desc))
    except Exception as error:
        result['error'] = str(error)[:250]
    return result

with ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(inspect, list(PAGES.items()) + list(DIRECT.items())))
(ROOT / 'manifest.json').write_text(json.dumps({'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'unreviewed-public-candidates', 'sources': results}, indent=2))
for s in results:
    print(s['id'], s.get('error', ''), [(a.get('path'), a.get('error','')) for a in s['assets']])
