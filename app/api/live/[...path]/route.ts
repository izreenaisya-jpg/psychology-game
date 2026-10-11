import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../../../chatgpt-auth';
import { handleLiveHttp } from '../../../../lib/live-cors.mjs';
async function handle(request: Request) {
 return handleLiveHttp(request, {db:env.DB,user:await getChatGPTUser(),signInPath:chatGPTSignInPath('/#live-host')});
}
export const GET=handle;
export const POST=handle;
export async function OPTIONS(request:Request){return handleLiveHttp(request);}
