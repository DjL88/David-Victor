"""One-time import of visually reviewed, SHA-pinned image bytes into this draft branch.
No public-site code is executed. Never modifies main, merges or deploys. Remove after import.
"""
import base64
import hashlib
import io
import json
import os
import re
import urllib.error
import urllib.request
import zipfile
from PIL import Image

REPO = 'DjL88/David-Victor'
BRANCH = 'feat/official-channel-brand-assets'
BASE = 'https://api.github.com/repos/' + REPO + '/'
TOKEN = os.environ['GH_TOKEN']
EXPECTED_HEAD = os.environ['SOURCE_SHA']
if os.environ.get('TARGET_BRANCH') != BRANCH or os.environ.get('TARGET_REPO') != REPO:
    raise RuntimeError('This importer is restricted to the requested draft branch.')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
OPENER = urllib.request.build_opener(NoRedirect)

def api(path, method='GET', payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={
        'Authorization': 'Bearer ' + TOKEN, 'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28',
    })
    with OPENER.open(req, timeout=30) as response:
        return json.load(response)

def artifact(artifact_id, expected_digest):
    req = urllib.request.Request(BASE + f'actions/artifacts/{artifact_id}/zip', headers={'Authorization': 'Bearer ' + TOKEN})
    try:
        OPENER.open(req, timeout=30)
        raise RuntimeError('Expected signed artifact redirect')
    except urllib.error.HTTPError as error:
        if error.code != 302:
            raise
        location = error.headers['Location']
    # Deliberately do NOT forward GitHub authorization to signed artifact storage.
    from urllib.parse import urlsplit
    url = urlsplit(location)
    if url.scheme != 'https' or not any((url.hostname or '').endswith(s) for s in ('.blob.core.windows.net', '.githubusercontent.com')):
        raise RuntimeError('Unexpected artifact host')
    with urllib.request.urlopen(location, timeout=30) as response:
        raw = response.read(16000001)
    if len(raw) > 16000000 or hashlib.sha256(raw).hexdigest() != expected_digest:
        raise RuntimeError('Artifact checksum mismatch')
    return zipfile.ZipFile(io.BytesIO(raw))

if api('git/ref/heads/' + BRANCH)['object']['sha'] != EXPECTED_HEAD:
    raise RuntimeError('Branch changed: reconcile rather than overwrite.')
archives = [
    artifact(10869739579, 'eec1a498171363fab712ac321b5bf9f940915e89a004bf5e68b81be22fb35d83'),
    artifact(10871321163, '66b60c3d61a286b6a90cb5bee8e96e6adfb139ffa8a49e3bfb8b53b86269c5dd'),
]
# id, reviewed archive index/path, exact original digest. No inferred provider IDs.
SELECTIONS = [
 ('deliveroo',1,'deliveroo-docs/image-2.png','1e251b4b560bfa6d56c9f08fe5c0f08bedd2f365430d874ca1732c8c5e4a0706'),
 ('doordash',0,'doordash/inline-1.svg','4f007809414e8f8a4e66b89941e8ecd26406788d7dcf50835c66555de87eb13d'),
 ('just-eat',1,'jet-uk-logos/image-0.png','18c04438dc3316024331ba5d5c994a74b86469486e84b119066f5e26ef8b3e3a'),
 ('thuisbezorgd',1,'jet-nl-logos/image-1.png','12f46ddc5bde664815692c0f5820493e85a1ee45b8a48a0edd4c8a0108d9527f'),
 ('lieferando',1,'jet-de-logos/image-2.png','01d1202e9a312cce1f5a1871cce53b141d2cdbfed32de60cc554d6d691bd3e06'),
 ('takeaway',1,'jet-be-logos/image-0.png','71df3fc21e30f31321cb7cacb0c535ecaf40d01d97d2510f9adfd04a36d5aff2'),
 ('grubhub',0,'grubhub/image-1.svg','1dba2a1236c57a7f2d3d8997daa89a2bbafcb2ce6c7d9a6b36d4d1e0c068609c'),
 ('uber-eats',0,'uber-eats/image-0.png','cfb1a6e9bdd312f5e10412b207e407d53e3f493ee152657ad5cbd15683f6e75a'),
 ('glovo',1,'glovo-kit/image-0.zip','9c826fadde2e5fa012011309edbf3c0fde9e9e309f282f4ecdc7264ba61bb806'),
 ('wolt',0,'wolt/image-3.png','c1977f8b9758a8763cb8811302b3933015fd11be72046c5c580f4e26ad13cc3f'),
 ('snappy-shopper',0,'snappy-shopper/image-6.png','6c41f5afb87e8372d372e3e1355cad6c80f58c97e63d049895c5e00e43f7a505'),
]
lookup = {}
for i,z in enumerate(archives):
    for source in json.loads(z.read('manifest.json'))['sources']:
        for candidate in source['assets']:
            if candidate.get('path'):
                lookup[(i,candidate['path'].removeprefix('channel-asset-review/'))] = (source,candidate)
files = {}
entries = []
for key,i,path,digest in SELECTIONS:
    raw = archives[i].read(path)
    if key == 'glovo':
        raw = zipfile.ZipFile(io.BytesIO(raw)).read('Logos/Vectorial/over white.svg')
    if hashlib.sha256(raw).hexdigest() != digest:
        raise RuntimeError('Reviewed original changed: ' + key)
    source,candidate = lookup[(i,path)]
    transform = 'Original artwork; no recolouring or geometric distortion.'
    if path.endswith('.svg') or key == 'glovo':
        svg = raw.decode()
        if key == 'doordash':
            svg = svg.replace('var(--base-color-red-60)', '#eb1700ff')
            transform = 'Native header symbol; its CSS fill resolved to the exact official page value #eb1700ff. Paths unchanged.'
        if 'xmlns=' not in svg:
            svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)
        svg = re.sub(r'\saria-hidden="[^"]*"', '', svg)
        if re.search(r'<script|<foreignObject|\son[a-z]+=|https?://(?!www.w3.org)', svg, re.I):
            raise RuntimeError('SVG requires further review: ' + key)
        content,extension = svg.encode(),'.svg'
    elif key == 'deliveroo':
        content,extension = raw,'.png'
        transform = 'Unchanged official developer-site 32px favicon. Small badge only; higher-resolution master pending.'
    else:
        image = Image.open(io.BytesIO(raw)).convert('RGBA')
        image.thumbnail((256,256), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, 'WEBP', lossless=True, method=6, exact=True)
        content,extension = output.getvalue(),'.webp'
        transform = 'Proportional reduction within 256px, preserving source canvas and colour; lossless WebP encoding. No generated/traced artwork.'
    asset_path = 'public/brand/channels/' + key + extension
    files[asset_path] = content
    entries.append({'id':key,'asset':'/brand/channels/'+key+extension,'sourcePage':source['page'],'sourceAsset':candidate.get('url',source['page']),'sourceArchiveMember':'Logos/Vectorial/over white.svg' if key=='glovo' else None,'originalSha256':digest,'assetSha256':hashlib.sha256(content).hexdigest(),'transformation':transform})
manifest = {'retrievedAt':'2026-09-25','status':'official-source-artwork-for-review','permission':'Trademarks belong to their owners. Public availability is not a commercial-use licence. Confirm applicable partner brand terms before publishing. JET media kit requests permission; Uber co-marketing requests Brand Desk approval.','entries':entries,'pending':[{'id':'uber-direct','sourcePage':'https://merchants.ubereats.com/gb/en/services/uber-direct/','reason':'No standalone official product artwork verified; neutral text fallback only.'},{'id':'jet-go','sourcePage':'https://developers.just-eat.com/documentation/jet-go','reason':'No standalone official product artwork verified; neutral text fallback only.'}]}
files['public/brand/channels/sources.json'] = (json.dumps(manifest,indent=2)+'\n').encode()
# Only the enumerated asset paths are ever written. No checkout or arbitrary file traversal.
if len(files) != 12 or not all(p.startswith('public/brand/channels/') for p in files):
    raise RuntimeError('Unexpected import set')
parent = api('git/commits/' + EXPECTED_HEAD)
tree = []
for path,content in files.items():
    blob = api('git/blobs','POST',{'encoding':'base64','content':base64.b64encode(content).decode()})
    tree.append({'path':path,'mode':'100644','type':'blob','sha':blob['sha']})
new_tree = api('git/trees','POST',{'base_tree':parent['tree']['sha'],'tree':tree})
commit = api('git/commits','POST',{'message':'feat(branding): add reviewed official channel assets and provenance','tree':new_tree['sha'],'parents':[EXPECTED_HEAD]})
if api('git/ref/heads/' + BRANCH)['object']['sha'] != EXPECTED_HEAD:
    raise RuntimeError('Concurrent change: do not move branch.')
api('git/refs/heads/' + BRANCH,'PATCH',{'sha':commit['sha'],'force':False})
print('Imported exactly',len(files),'reviewed asset/provenance files into draft branch',BRANCH,'commit',commit['sha'])
