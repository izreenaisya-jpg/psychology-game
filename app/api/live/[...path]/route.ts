import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../../../chatgpt-auth';
import { handleLive } from '../../../../lib/live-service.mjs';
async function handle(request: Request) {
 return handleLive(request, {db:env.DB,user:await getChatGPTUser(),signInPath:chatGPTSignInPath('/#live-host')});
}
export const GET=handle;
export const POST=handle;
