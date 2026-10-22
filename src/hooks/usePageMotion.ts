import {useEffect,useState} from 'react';

export function useReducedMotion(){
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
  return reduced;
}

export function usePageMotion(){
  const [active,setActive]=useState('inicio');
  const [scrolled,setScrolled]=useState(window.scrollY>20);
  const reduced=useReducedMotion();
  useEffect(()=>{
    // React mounts after settings load, so native initial anchor scrolling can run too early.
    if(!location.hash)return;
    let id='';try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
    const frame=requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'instant',block:'start'}));
    return()=>cancelAnimationFrame(frame);
  },[]);
  useEffect(()=>{
    const elements=document.querySelectorAll<HTMLElement>('[data-reveal]');
    if(reduced||typeof IntersectionObserver==='undefined'){elements.forEach(el=>el.classList.add('revealed'));return}
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target)}})},{threshold:.08});
    elements.forEach(el=>{if(el.getBoundingClientRect().top<window.innerHeight)el.classList.add('revealed');else{el.classList.add('reveal-ready');observer.observe(el)}});
    return()=>{observer.disconnect();elements.forEach(el=>el.classList.remove('reveal-ready'))};
  },[reduced]);
  useEffect(()=>{
    let frame=0;
    const update=()=>{frame=0;setScrolled(window.scrollY>20);const sections=[...document.querySelectorAll<HTMLElement>('main>section[id]')];let current='inicio';for(const section of sections){if(section.getBoundingClientRect().top<=window.innerHeight*.35)current=section.id}setActive(current)};
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(update)};
    window.addEventListener('scroll',scroll,{passive:true});update();
    return()=>{window.removeEventListener('scroll',scroll);cancelAnimationFrame(frame)};
  },[]);
  return {active,scrolled};
}
