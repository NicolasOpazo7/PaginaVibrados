import {useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import {useReducedMotion} from '../hooks/usePageMotion';
import {asset} from '../config';

type NetworkConnection=EventTarget&{saveData?:boolean;effectiveType?:string};

export default function HeroMedia(){
  const reduced=useReducedMotion();
  const video=useRef<HTMLVideoElement>(null),container=useRef<HTMLDivElement>(null);
  const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width: 700px)').matches);
  const [ready,setReady]=useState(false),[saveData,setSaveData]=useState(false),[inView,setInView]=useState(true),[visible,setVisible]=useState(true);
  const [paused,setPaused]=useState(false),[playing,setPlaying]=useState(false),[blocked,setBlocked]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia('(max-width: 700px)');
    const update=()=>{setMobile(query.matches);setPlaying(false);setFailed(false)};
    query.addEventListener('change',update);
    const connection=(navigator as Navigator&{connection?:NetworkConnection}).connection;
    const network=()=>setSaveData(Boolean(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType||'')));
    network();connection?.addEventListener('change',network);setReady(true);
    const visibility=()=>setVisible(!document.hidden);visibility();document.addEventListener('visibilitychange',visibility);
    const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>setInView(entries[0].isIntersecting),{threshold:.05}):null;
    if(container.current)observer?.observe(container.current);
    return()=>{query.removeEventListener('change',update);connection?.removeEventListener('change',network);document.removeEventListener('visibilitychange',visibility);observer?.disconnect()};
  },[]);
  const enabled=ready&&!reduced&&!saveData&&!failed;
  const src=asset(`/media/hero-postes-${mobile?'mobile':'desktop'}.mp4`);
  useEffect(()=>{
    const el=video.current;if(!el||!enabled)return;
    if(paused||!inView||!visible){el.pause();return}
    el.muted=true;
    el.play().then(()=>setBlocked(false)).catch(()=>{setBlocked(true);setPlaying(false)});
  },[enabled,paused,inView,visible,src]);
  async function toggle(){
    if(!video.current)return;
    if(!paused&&!blocked){setPaused(true);video.current.pause()}
    else{setPaused(false);try{await video.current.play();setBlocked(false)}catch{setBlocked(true)}}
  }
  return <><div className="hero-media" ref={container} aria-hidden="true">
    <picture><source media="(max-width: 700px)" srcSet={asset('/media/hero-postes-mobile-poster.jpg')}/><img className="hero-poster" src={asset('/media/hero-postes-desktop-poster.jpg')} alt="" fetchPriority="high" width="478" height="298"/></picture>
    {enabled&&<video ref={video} className={`hero-video ${playing?'is-playing':''}`} src={src} poster={asset(`/media/hero-postes-${mobile?'mobile':'desktop'}-poster.jpg`)} autoPlay muted loop playsInline preload="metadata" tabIndex={-1} disablePictureInPicture onPlaying={()=>setPlaying(true)} onError={()=>{setFailed(true);setPlaying(false)}}/>}
  </div>{enabled&&<button className="hero-motion-control" onClick={toggle} aria-label={paused||blocked?'Reproducir video de fondo':'Pausar video de fondo'}>{paused||blocked?<Play size={14}/>:<Pause size={14}/>}<span>{paused||blocked?'Reproducir fondo':'Pausar fondo'}</span></button>}</>;
}
