const ANTIGOS = ["suiciniv-dev-apps.pages.dev", "www.suiciniv.dev"];

export const onRequest = ({ request, next }) => {
  const url = new URL(request.url);
  if (!ANTIGOS.includes(url.hostname)) return next();
  url.hostname = "suiciniv.dev";
  return Response.redirect(url.toString(), 301);
};
