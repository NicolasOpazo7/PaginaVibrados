import {useState,type FormEvent} from 'react';
import {ArrowDown,ArrowUp,Image,Trash2} from 'lucide-react';
import {api,type Project,type ProjectMedia} from '../config';

const categories=['Cierres perimetrales','Parcelas y lotes','Cierres para empresas'];
const accept='image/jpeg,image/png,image/webp,video/mp4,video/webm';
type Run=(fn:()=>Promise<unknown>)=>Promise<void>;
function MediaItem({media,project,run,index}:{media:ProjectMedia;project:Project;run:Run;index:number}){
  const [busy,setBusy]=useState(false);
  async function move(direction:number){const other=project.media[index+direction];if(!other)return;await run(()=>api(`/admin/projects/${project.id}/media/order`,{method:'PUT',body:JSON.stringify({ids:project.media.map(m=>m.id).map((id,i)=>i===index?other.id:i===index+direction?media.id:id)})}))}
  return <div className="admin-media-item">
    {media.type==='image'?<img src={media.src} alt={media.alt||project.title} loading="lazy"/>:<video src={media.src} poster={media.thumbnail} controls preload="metadata" playsInline/>}
    <span>{media.type==='video'?'VIDEO':'IMAGEN'} · {index+1}</span>
    <form onSubmit={e=>{e.preventDefault();const form=e.currentTarget;run(()=>api(`/admin/media/${media.id}`,{method:'PATCH',body:JSON.stringify({alt:new FormData(form).get('alt')})}))}}><label>Descripción accesible<input name="alt" defaultValue={media.alt} maxLength={250}/></label><button className="outline-button">Guardar descripción</button></form>
    {media.type==='video'&&<form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;setBusy(true);try{await run(()=>api(`/admin/media/${media.id}/thumbnail`,{method:'POST',body:new FormData(form)}))}finally{setBusy(false)}}}><label>Miniatura opcional (JPG/PNG/WebP, máx. 5 MB)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required/></label><button disabled={busy} className="outline-button"><Image size={15}/>Guardar miniatura</button></form>}
    <div className="actions"><button className="icon-button" disabled={index===0} aria-label="Mover archivo antes" onClick={()=>move(-1)}><ArrowUp size={17}/></button><button className="icon-button" disabled={index===project.media.length-1} aria-label="Mover archivo después" onClick={()=>move(1)}><ArrowDown size={17}/></button><button className="outline-button" disabled={project.media.length===1} onClick={()=>{if(confirm('¿Eliminar este archivo del proyecto?'))run(()=>api(`/admin/media/${media.id}`,{method:'DELETE'}))}}><Trash2 size={15}/> Quitar</button></div>
  </div>;
}
export default function ProjectManager({projects,run}:{projects:Project[];run:Run}){
  const[busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>,url:string){e.preventDefault();const form=e.currentTarget;setBusy(true);try{await run(async()=>{await api(url,{method:'POST',body:new FormData(form)});form.reset()})}finally{setBusy(false)}}
  return <><h2>PROYECTOS</h2><p>Hasta 8 archivos por carga. Fotos: JPG, PNG o WebP, máx. 5 MB. Videos: MP4 o WebM, máx. 40 MB. Máximo 120 MB por carga.</p>
    <form className="quote-form" onSubmit={e=>submit(e,'/admin/projects')}><label>Título<input name="title" required maxLength={150}/></label><label>Categoría<select name="category"><option value="">Sin categoría</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Descripción breve<textarea name="description" maxLength={2000}/></label><label>Fotos y videos autorizados<input name="media" type="file" multiple required accept={accept}/></label><button className="button" disabled={busy}>{busy?'Subiendo…':'Agregar proyecto'}</button></form>
    {projects.map(p=><details className="admin-project" key={p.id}><summary>{p.title} <span>{p.media.length} archivos</span></summary><form className="review" onSubmit={e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));run(()=>api(`/admin/projects/${p.id}`,{method:'PUT',body:JSON.stringify(d)}))}}><label>Título<input name="title" defaultValue={p.title} required maxLength={150}/></label><label>Categoría<select name="category" defaultValue={p.category}><option value="">Sin categoría</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Descripción<textarea name="description" defaultValue={p.description} maxLength={2000}/></label><label>Orden del proyecto<input name="position" type="number" step="1" defaultValue={p.position}/></label><button className="button">Guardar cambios</button><button type="button" className="outline-button" onClick={()=>{if(confirm('¿Eliminar este proyecto y retirarlo de la galería?'))run(()=>api(`/admin/projects/${p.id}`,{method:'DELETE'}))}}>Eliminar proyecto</button></form>
    <div className="admin-media-grid">{p.media.map((m,i)=><MediaItem key={m.id} media={m} project={p} run={run} index={i}/>)}</div><form className="quote-form" onSubmit={e=>submit(e,`/admin/projects/${p.id}/media`)}><label>Agregar fotos o videos<input name="media" type="file" multiple required accept={accept}/></label><button className="button" disabled={busy}>{busy?'Subiendo…':'Agregar archivos'}</button><small>El primer archivo es la portada. Usa las flechas para ordenar.</small></form></details>)}
  </>;
}
