"""Prepare the selected WhatsApp clip as a silent responsive hero background."""
import argparse
import pathlib
import subprocess
import sys

sys.path.insert(0, '.test-data/media-tools')
import imageio_ffmpeg

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=pathlib.Path, required=True)
args = parser.parse_args()
exe = imageio_ffmpeg.get_ffmpeg_exe()
target = pathlib.Path('public/media')

def run(arguments):
    subprocess.run([exe, '-hide_banner', '-loglevel', 'error', '-y', *arguments], check=True)

# Keep the native resolution: enlarging it would not recover additional detail.
# Forward/reverse playback returns to the starting frame without a hard cut.
for variant, crop, quality in [('desktop', '478:298:0:230', '23'), ('mobile', '478:850:0:0', '27')]:
    name = f'hero-postes-{variant}'
    filters = f'fps=24,crop={crop},setsar=1,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]'
    print('Preparing', name, flush=True)
    run(['-ss', '3', '-t', '6.5', '-i', str(args.source), '-filter_complex', filters, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', quality, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-map_metadata', '-1', str(target / f'{name}.mp4')])
    run(['-i', str(target / f'{name}.mp4'), '-frames:v', '1', '-q:v', '3', str(target / f'{name}-poster.jpg')])
    print(name, (target / f'{name}.mp4').stat().st_size, 'bytes', flush=True)
