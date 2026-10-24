import {useEffect,useLayoutEffect,useState} from 'react';

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
  useLayoutEffect(()=>{
    const elements=document.querySelectorAll<HTMLElement>('[data-reveal]');
    const targets=new Map<HTMLElement,HTMLElement[]>();
    elements.forEach(section=>{
      const parts=Array.from(section.querySelectorAll<HTMLElement>('.section-heading, .service-grid > .service, .gallery-access, .project-motion-wrapper, .reviews-motion-wrapper, .quote-grid > *, .company-strip > .wrap'));
      targets.set(section,parts.length?parts:[section]);
    });
    const show=(section:HTMLElement)=>{
      section.classList.add('revealed');
      targets.get(section)?.forEach(el=>el.classList.add('entrance-visible'));
    };
    if(reduced||typeof IntersectionObserver==='undefined'){elements.forEach(show);return}
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting){show(entry.target as HTMLElement);observer.unobserve(entry.target)}});
    },{threshold:0,rootMargin:'0px 0px -100px 0px'});
    const focus=(event:FocusEvent)=>{
      const section=(event.target as HTMLElement).closest<HTMLElement>('[data-reveal]');
      if(section){show(section);observer.unobserve(section)}
    };
    elements.forEach(section=>{
      // Sections already seen (including after a preference change) stay visible.
      if(section.classList.contains('revealed')||section.getBoundingClientRect().top<window.innerHeight-100){show(section);return}
      targets.get(section)?.forEach((el,index)=>{
        el.classList.add('entrance-ready');
        el.style.setProperty('--entrance-delay',`${Math.min(index,3)*90}ms`);
      });
      observer.observe(section);
    });
    document.addEventListener('focusin',focus);
    return()=>{
      observer.disconnect();document.removeEventListener('focusin',focus);
      targets.forEach(parts=>parts.forEach(el=>{el.classList.remove('entrance-ready');el.style.removeProperty('--entrance-delay')}));
    };
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
