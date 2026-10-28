export function gbpBusinessKey(uid,business) {
  return encodeURIComponent(JSON.stringify([uid,business?.id || business?.place_id || business?.placeId || [business?.name,business?.city,business?.uf,business?.address]]));
}
const pending = (it) => !it || it.isPending || /\[PENDENTE\]/i.test(`${it.name || ""} ${it.description || ""}`);
/** @param {any} options */
export function buildApprovedSiteBriefing({pkg,approvedItems={},identityApproved,packageApproved,selectedPalette,logoPreview,userPhotos=[],businessKey,ownerUid}) {
  if (!pkg || !ownerUid || !identityApproved || !packageApproved || !approvedItems.bio) throw new Error("Revise e aprove a identidade, o pacote e a descrição antes de enviar ao Site Express.");
  const services=(pkg.services || []).filter((it,i)=>approvedItems[`svc-${i}`] && !pending(it));
  const products=(pkg.products || []).filter((it,i)=>approvedItems[`prod-${i}`] && !pending(it));
  return {...pkg,services,products,approvedServices:services,approvedProducts:products,approvedDescription:pkg.description750,approvedBranding:{palette:selectedPalette,logo:logoPreview,approved:true},approvedMedia:userPhotos,description750:pkg.description750,branding:{palette:selectedPalette,logo:logoPreview,approved:true},photos:userPhotos,approval:{ownerUid,businessKey,approvedAt:new Date().toISOString()},siteBriefing:{...pkg.siteBriefing,approvedServices:services,approvedProducts:products}};
}
