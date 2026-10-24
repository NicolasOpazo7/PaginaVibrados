import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {createPortal} from 'react-dom';

const stack:HTMLDivElement[]=[];
let originalOverflow='';
export default function Modal({children,close,label='Ventana de detalles',suspended=false}:{children:ReactNode;close:()=>void;label?:string;suspended?:boolean}){
  const ref=useRef<HTMLDivElement>(null);
  const closeRef=useRef(close);closeRef.current=close;
  const suspendedRef=useRef(suspended);suspendedRef.current=suspended;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement;
    const node=ref.current!;
    if(!stack.length)originalOverflow=document.body.style.overflow;
    stack.push(node);
    document.body.style.overflow='hidden';
    if(!suspendedRef.current)node.focus();
    const escape=(e:KeyboardEvent)=>{if(stack.at(-1)===node&&!suspendedRef.current&&e.key==='Escape'){e.stopImmediatePropagation();closeRef.current()}};
    window.addEventListener('keydown',escape,true);
    return()=>{window.removeEventListener('keydown',escape,true);stack.splice(stack.indexOf(node),1);if(!stack.length)document.body.style.overflow=originalOverflow;if(previous?.isConnected)previous.focus()};
  },[]);
  return createPortal(<div className="modal-backdrop" inert={suspended||undefined} aria-hidden={suspended||undefined} onClick={close}><div ref={ref} tabIndex={-1} role="dialog" aria-modal={!suspended} aria-label={label} className="modal" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,video[controls],summary');
    if(!nodes?.length)return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus()}
  }}><button className="close" aria-label="Cerrar ventana" onClick={close}><X/></button>{children}</div></div>,document.body);
}
