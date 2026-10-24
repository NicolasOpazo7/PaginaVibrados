import {api,type Review} from '../config';
import {useSupabase,listAdminReviews,loginReviewsAdmin,logoutReviewsAdmin,moderateSupabaseReview,deleteSupabaseReview} from './supabaseReviews';
export const adminUsesEmail=useSupabase;
export const listReviews=()=>useSupabase?listAdminReviews():api('/admin/reviews');
export const signIn=(username:string,password:string)=>useSupabase?loginReviewsAdmin(username,password):api('/admin/login',{method:'POST',body:JSON.stringify({username,password})});
export const signOut=()=>useSupabase?logoutReviewsAdmin():api('/admin/logout',{method:'POST'});
export const moderateReview=(id:Review['id'],status:string)=>useSupabase?moderateSupabaseReview(id,status):api(`/admin/reviews/${id}`,{method:'PATCH',body:JSON.stringify({status})});
export const removeReview=(id:Review['id'])=>useSupabase?deleteSupabaseReview(id):api(`/admin/reviews/${id}`,{method:'DELETE'});
