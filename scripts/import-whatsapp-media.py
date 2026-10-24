"""Optimize and catalog the supplied media, deduplicating by original SHA-256."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

from PIL import Image, ImageOps

sys.path.insert(0, '.test-data/media-tools')
import imageio_ffmpeg

parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=pathlib.Path, required=True)
args = parser.parse_args()
target = pathlib.Path('public/media/trabajos')
target.mkdir(parents=True, exist_ok=True)
catalog_path = pathlib.Path('content/projects.json')
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
seen = {p.get('sourceHash') for p in catalog if p.get('sourceHash')}
seen.update(hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('public/media').glob('*') if p.is_file())
exe = imageio_ffmpeg.get_ffmpeg_exe()

def run(arguments):
    subprocess.run([exe, '-hide_banner', '-loglevel', 'error', '-y', *arguments], check=True)

photo_titles = [
    'Placas de hormigón apiladas', 'Carga de placas para despacho',
    'Postes de hormigón preparados', 'Postes para cierres',
    'Instalación de cierre', 'Materiales en producción',
    'Despacho de materiales', 'Fabricación de placas',
    'Placas de hormigón en fabricación', 'Trabajo de instalación',
    'Materiales para el montaje', 'Montaje de cierre perimetral',
    'Producción de placas', 'Acceso con cierre de hormigón',
    'Cierre junto a vivienda', 'Cierre instalado en patio',
    'Cierre a lo largo del terreno', 'Vista de cierre perimetral',
    'Cierre en acceso a propiedad', 'Detalle de placas instaladas',
    'Avance de instalación', 'Postes y placas instalados',
    'Terminación de cierre', 'Detalle de unión de placas',
    'Placas listas para su preparación',
]
video_titles = [
    'Recorrido por la producción de placas', 'Placas de hormigón en fabricación',
    'Postes de hormigón para instalación', 'Cierre instalado en terreno',
    'Despacho de placas de hormigón', 'Recorrido por cierre perimetral',
    'Detalle de postes de hormigón', 'Materiales preparados en taller',
    'Cierre y acceso a propiedad', 'Traslado de materiales',
    'Instalación de cierre en terreno',
]
counts = {'image': 0, 'video': 0}
report = []
for source in sorted(args.source_dir.iterdir()):
    if source.suffix.lower() not in ('.jpeg', '.jpg', '.png', '.mp4'):
        continue
    kind = 'video' if source.suffix.lower() == '.mp4' else 'image'
    number = counts[kind]
    counts[kind] += 1
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest in seen:
        print('Already included:', source.name, flush=True)
        continue
    seen.add(digest)
    name = f'{kind}-{digest[:12]}'
    thumbnail = None
    print('Preparing:', source.name, flush=True)
    if kind == 'image':
        output = target / f'{name}.jpg'
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            image.save(output, quality=87, optimize=True, progressive=True)
    else:
        output = target / f'{name}.mp4'
        run(['-i', str(source), '-vf', "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1", '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-map_metadata', '-1', str(output)])
        poster = target / f'{name}-poster.jpg'
        run(['-ss', '0.1', '-i', str(output), '-frames:v', '1', '-q:v', '3', str(poster)])
        thumbnail = '/' + poster.relative_to('public').as_posix()
    title = (photo_titles if kind == 'image' else video_titles)[number]
    url = '/' + output.relative_to('public').as_posix()
    identifier = -100 - len(catalog)
    media = {'id': identifier, 'type': kind, 'src': url, 'alt': title, 'position': 0}
    if thumbnail:
        media['thumbnail'] = thumbnail
    catalog.append({'id': identifier, 'title': title, 'category': 'Cierres perimetrales' if ('cierre' in title.lower() or 'instala' in title.lower()) else '', 'description': '', 'position': len(catalog), 'image': thumbnail or url, 'importBatch': 'provided-media-2026-10-22', 'sourceHash': digest, 'media': [media]})
    report.append({'source': source.name, 'sha256': digest, 'output': url, 'originalBytes': source.stat().st_size, 'optimizedBytes': output.stat().st_size})
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
if report:
    pathlib.Path('content/media-import-2026-10-22.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Added {len(report)} files.', flush=True)
