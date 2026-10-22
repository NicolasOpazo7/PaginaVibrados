/** Keep the viewport within the central copy, retaining fractional pixels at the seam. */
export function wrapLoopOffset(offset:number,width:number){
  if(width<=0)return offset;
  return width+((offset-width)%width+width)%width;
}
