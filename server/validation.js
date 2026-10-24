export function validateReview(b){if(b.name!==undefined&&(typeof b.name!=='string'||b.name.length>100))return 'El nombre o apodo debe tener hasta 100 caracteres.';if(!Number.isInteger(Number(b.rating))||Number(b.rating)<1||Number(b.rating)>5)return 'Selecciona entre 1 y 5 estrellas.';if(typeof b.comment!=='string'||b.comment.trim().length<10||b.comment.length>2000)return 'Escribe entre 10 y 2000 caracteres.';if(b.consent!=='on')return 'Debes aceptar la política de privacidad.';return null}
export function isImage(b){if(b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(b.length>3&&b[0]===255&&b[1]===216&&b[2]===255)return 'jpg';if(b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'webp';return null}
export function mediaType(buffer){
  const image=isImage(buffer);if(image)return {type:'image',ext:image};
  if(buffer.length>=24&&buffer.toString('ascii',4,8)==='ftyp'&&/^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V )$/.test(buffer.toString('ascii',8,12)))return {type:'video',ext:'mp4'};
  if(buffer.length>16&&buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))&&buffer.subarray(0,512).includes(Buffer.from('webm')))return {type:'video',ext:'webm'};
  return null;
}
export function validateProject(body){
  if(typeof body.title!=='string'||!body.title.trim()||body.title.length>150)return 'Ingresa un título de hasta 150 caracteres.';
  if(body.description!==undefined&&(typeof body.description!=='string'||body.description.length>2000))return 'Descripción demasiado larga.';
  if(!['','Cierres perimetrales','Parcelas y lotes','Cierres para empresas'].includes(body.category??''))return 'Categoría inválida.';
  return null;
}
