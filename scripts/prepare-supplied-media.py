"""Prepare user-supplied clips; originals remain untouched. Requires imageio-ffmpeg."""
import sys,subprocess,pathlib,json,shutil,argparse
sys.path.insert(0,'.test-data/media-tools')
import imageio_ffmpeg
exe=imageio_ffmpeg.get_ffmpeg_exe()
parser=argparse.ArgumentParser(description='Optimize the three supplied screen recordings for the website.')
parser.add_argument('--source-dir',type=pathlib.Path,required=True,help='Directory containing the original recordings and IMG_0073.JPEG')
args=parser.parse_args()
root=pathlib.Path('public/media');root.mkdir(parents=True,exist_ok=True)
source=args.source_dir
texture=source/'ScreenRecording_10-21-2026 23-11-32_1.mp4'
filters='hqdn3d=1.0:1.0:3:3,eq=contrast=1.04:brightness=0.005:saturation=1.03,unsharp=5:5:0.3:3:3:0'
def run(args):subprocess.run([exe,'-hide_banner','-loglevel','error','-y',*args],check=True)
for name,crop,scale,crf in [('hero-desktop','820:462:4:260','960:540',23),('hero-mobile','800:1200:14:20','480:720',24)]:
 vf=f'fps=24,crop={crop},scale={scale}:flags=lanczos:in_range=full:out_range=tv,{filters},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]'
 print('Preparing',name,flush=True)
 run(['-ss','4','-t','6','-i',str(texture),'-filter_complex',vf,'-map','[v]','-an','-c:v','libx264','-preset','slow','-crf',str(crf),'-pix_fmt','yuv420p','-movflags','+faststart','-map_metadata','-1',str(root/(name+'.mp4'))])
 run(['-ss','1','-i',str(root/(name+'.mp4')),'-frames:v','1','-q:v','3',str(root/(name+'-poster.jpg'))])
for filename,name,crop,at in [('ScreenRecording_10-21-2026 23-12-12_1.mp4','materiales-instalacion','740:1220:40:10',3),('ScreenRecording_10-21-2026 23-13-10_1.mp4','cierre-instalado','828:1232:0:0',1)]:
 print('Preparing',name,flush=True)
 run(['-i',str(source/filename),'-vf',f'fps=30,crop={crop},scale=720:-2:flags=lanczos:in_range=full:out_range=tv,{filters}','-an','-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','-map_metadata','-1',str(root/(name+'.mp4'))])
 run(['-ss',str(at),'-i',str(root/(name+'.mp4')),'-frames:v','1','-q:v','3',str(root/(name+'-poster.jpg'))])
shutil.copyfile(source/'IMG_0073.JPEG',root/'montaje-cierre.jpg')
report={p.name:p.stat().st_size for p in root.iterdir() if p.is_file()}
print(json.dumps(report,indent=2),flush=True)
