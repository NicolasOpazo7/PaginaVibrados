from PIL import Image, ImageDraw
import io,struct
frame=Image.new('RGB',(320,180),(25,30,25));draw=ImageDraw.Draw(frame);draw.rectangle((20,20,300,160),outline=(245,189,0),width=3);draw.text((75,75),'VIDEO DE PRUEBA',fill=(245,189,0))
buf=io.BytesIO();frame.save(buf,format='WEBP',quality=80);webp=buf.getvalue();pos=12;vp8=None
while pos<len(webp):
 tag=webp[pos:pos+4];size=int.from_bytes(webp[pos+4:pos+8],'little')
 if tag==b'VP8 ': vp8=webp[pos+8:pos+8+size];break
 pos+=8+size+(size%2)
assert vp8

def vint(n):
 for length in range(1,9):
  if n<(1<<(length*7))-1:return ((1<<(length*7))|n).to_bytes(length,'big')
def element(id,data):return bytes.fromhex(id)+vint(len(data))+data
def uint(id,n):return element(id,n.to_bytes(max(1,(n.bit_length()+7)//8),'big'))
header=element('1a45dfa3',uint('4286',1)+uint('42f7',1)+uint('42f2',4)+uint('42f3',8)+element('4282',b'webm')+uint('4287',4)+uint('4285',2))
info=element('1549a966',uint('2ad7b1',1000000)+element('4d80',b'Test fixture')+element('5741',b'Vibrados tests')+element('4489',struct.pack('>d',4000)))
track=element('1654ae6b',element('ae',uint('d7',1)+uint('73c5',1)+uint('83',1)+element('86',b'V_VP8')+uint('23e383',200000000)+element('e0',uint('b0',320)+uint('ba',180))))
blocks=b''.join(element('a3',b'\x81'+struct.pack('>h',i*200)+b'\x80'+vp8) for i in range(20))
cluster=element('1f43b675',uint('e7',0)+blocks)
open('server/fixtures/test.webm','wb').write(header+element('18538067',info+track+cluster))
