import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Pause,Play,Quote,UserRound,CalendarDays,Expand} from 'lucide-react';
import type {Review} from '../config';
import {useReducedMotion} from '../hooks/usePageMotion';
import {wrapLoopOffset} from '../utils/carousel';
import Modal from './Modal';

function ReviewCard({review,hidden=false,onOpen}:{review:Review;hidden?:boolean;onOpen:(keyboard?:boolean)=>void}){
  return <article className="review-card" aria-hidden={hidden||undefined} role="button" tabIndex={hidden?-1:0} aria-label={`Ver reseña completa de ${review.name?.trim()||'Anónimo'}`} onClick={()=>onOpen()} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(true)}}}>
    <div className="review-top"><div className="review-author"><span className="review-avatar" aria-hidden="true"><UserRound size={26} strokeWidth={1.6}/></span><div><strong>{review.name?.trim()||'Anónimo'}</strong><span className="review-subtitle">Opinión de cliente</span><span className="stars" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></div></div><Quote className="review-quote" size={30} fill="currentColor" strokeWidth={0} aria-hidden="true"/></div>
    <p className="review-comment">{review.comment}</p>
    {review.image&&<img className="review-work-photo" src={review.image} alt="Fotografía del trabajo adjunta a la reseña" loading="lazy" draggable={false}/>}
    {review.created&&<div className="review-date"><CalendarDays size={16} aria-hidden="true"/><time dateTime={review.created}>{new Date(review.created).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'})}</time></div>}
    {review.response&&<p className="review-response"><strong>Vibrados Lagunilla</strong>{review.response}</p>}
    <span className="review-expand"><Expand size={14}/>Ver reseña completa</span>
  </article>;
}

export default function ReviewsCarousel({reviews}:{reviews:Review[]}){
  const viewport=useRef<HTMLDivElement>(null),group=useRef<HTMLDivElement>(null);
  const interaction=useRef({hover:false,focus:false,drag:false,idleUntil:0,pointerUntil:0,x:0,y:0,left:0,moved:false});
  const [paused,setPaused]=useState(false),[selected,setSelected]=useState<Review|null>(null);
  const pausedRef=useRef(paused);pausedRef.current=paused||!!selected;
  const reduced=useReducedMotion(),loop=reviews.length>1&&!reduced;
  // Each identical group fills the viewport, including when only two reviews exist.
  const repeated=reviews.length>1?Array.from({length:Math.max(1,Math.ceil(4/reviews.length))},()=>reviews).flat():reviews;
  useEffect(()=>{
    const el=viewport.current,batch=group.current;if(!el||!batch||!loop)return;
    let width=batch.getBoundingClientRect().width,frame=0,last=0,position=width;
    el.scrollLeft=position;
    const resize=new ResizeObserver(()=>{const next=batch.getBoundingClientRect().width;position=width?el.scrollLeft/width*next:next;width=next;el.scrollLeft=position});resize.observe(batch);
    const tick=(now:number)=>{
      const delta=last?Math.min(now-last,50):0;last=now;
      if(!document.hidden){
        const state=interaction.current;
        if(!pausedRef.current&&!state.hover&&!state.focus&&!state.drag&&now>state.idleUntil){
          // One complete group in at least 32 seconds; cap speed for readability.
          position+=Math.min(width/32,42)*delta/1000;
        }else position=el.scrollLeft;
        if(!state.drag)position=wrapLoopOffset(position,width);
        el.scrollLeft=position;
      }
      frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);resize.disconnect()};
  },[loop,reviews.length]);
  function open(review:Review,keyboard=false){if(keyboard||!interaction.current.moved)setSelected(review)}
  function step(direction:number){const el=viewport.current;if(!el)return;interaction.current.idleUntil=performance.now()+5000;el.scrollLeft+=direction*((el.querySelector('article')?.getBoundingClientRect().width||300)+20)}
  return <div className="carousel" role="region" aria-roledescription="carrusel" aria-label="Reseñas de clientes">
    <div className="carousel-controls"><span>{reduced?'Desliza para leer las reseñas':'Desliza para explorar · pausa al leer'}</span><div>
      {reviews.length>1&&<><button className="icon-button" aria-label="Reseña anterior" onClick={()=>step(-1)}><ChevronLeft size={19}/></button><button className="icon-button" aria-label="Reseña siguiente" onClick={()=>step(1)}><ChevronRight size={19}/></button></>}
      {loop&&<button className="carousel-pause" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Reanudar':'Pausar'}</button>}
    </div></div>
    <div className={`carousel-viewport ${loop?'is-loop':''}`} ref={viewport} tabIndex={0} aria-label="Reseñas. Usa las flechas para desplazarte."
      onMouseEnter={()=>{interaction.current.hover=true}} onMouseLeave={()=>{interaction.current.hover=false}}
      onFocusCapture={()=>{interaction.current.focus=performance.now()>interaction.current.pointerUntil}} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))interaction.current.focus=false}}
      onWheel={()=>{interaction.current.idleUntil=performance.now()+3000}}
      onKeyDown={e=>{interaction.current.focus=true;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1)}}}
      onPointerDown={e=>{if(e.button!==0)return;const state=interaction.current;state.pointerUntil=performance.now()+1000;state.focus=false;state.drag=true;state.x=e.clientX;state.y=e.clientY;state.left=e.currentTarget.scrollLeft;state.moved=false}}
      onPointerMove={e=>{const state=interaction.current;if(!state.drag)return;if(Math.abs(e.clientX-state.x)>6||Math.abs(e.clientY-state.y)>6)state.moved=true;if(state.moved&&e.pointerType==='mouse'){if(!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.scrollLeft=state.left-(e.clientX-state.x)}}}
      onPointerUp={e=>{interaction.current.drag=false;interaction.current.idleUntil=performance.now()+3000;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
      onPointerCancel={()=>{interaction.current.drag=false;interaction.current.moved=true;interaction.current.idleUntil=performance.now()+3000}}>
      <div className="carousel-track">
        {loop?<>{[0,1,2].map(copy=><div className="carousel-group" key={copy} ref={copy===0?group:undefined} aria-hidden={copy!==1||undefined}>{repeated.map((r,index)=><ReviewCard key={`${r.id}-${index}`} review={r} hidden={copy!==1||index>=reviews.length} onOpen={keyboard=>open(r,keyboard)}/>)}</div>)}</>:<div className="carousel-group">{reviews.map(r=><ReviewCard key={r.id} review={r} onOpen={keyboard=>open(r,keyboard)}/>)}</div>}
      </div>
    </div>
    {selected&&<Modal close={()=>setSelected(null)} label={`Reseña de ${selected.name?.trim()||'Anónimo'}`}><div className="review-detail"><div className="review-author"><span className="review-avatar" aria-hidden="true"><UserRound size={30}/></span><div><h2>{selected.name?.trim()||'Anónimo'}</h2><span className="review-subtitle">Opinión de cliente</span><span className="stars" aria-label={`${selected.rating} de 5 estrellas`}>{'★'.repeat(selected.rating)}{'☆'.repeat(5-selected.rating)}</span></div></div><p className="review-detail-comment">{selected.comment}</p>{selected.image&&<figure><img src={selected.image} alt={`Imagen compartida en la reseña de ${selected.name?.trim()||'Anónimo'}`}/><figcaption>Imagen compartida por el autor de la reseña.</figcaption></figure>}{selected.created&&<div className="review-date"><CalendarDays size={17}/><time dateTime={selected.created}>{new Date(selected.created).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'})}</time></div>}{selected.response&&<div className="review-detail-response"><strong>Respuesta de Vibrados Lagunilla</strong><p>{selected.response}</p></div>}</div></Modal>}
  </div>;
}
