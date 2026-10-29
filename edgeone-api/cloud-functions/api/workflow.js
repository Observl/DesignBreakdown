import {workflowContract} from '../../lib/workflow.mjs';
export function onRequest({request}) {
  if(request.method!=='GET')return new Response(null,{status:405});
  return Response.json(workflowContract,{headers:{'Access-Control-Allow-Origin':'https://observl.github.io','Cache-Control':'no-store'}});
}
