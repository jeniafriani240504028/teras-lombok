"use strict";

const { personalEmail, personalSocials } = window.PROJECT_CONFIG;
const links = document.getElementById("personal-links");

function addLink(label, href, external) {
  const link = document.createElement("a");
  link.textContent = label;
  link.href = href;
  if (external) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  links.append(link);
}

if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(personalEmail)) addLink("Email", "mailto:" + personalEmail, false);

for (const [key, label] of Object.entries({ instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" })) {
  try {
    const href = new URL(personalSocials[key]);
    if (href.protocol === "https:" && [key + ".com", "www." + key + ".com", "m." + key + ".com"].includes(href.hostname)) {
      addLink(label + "", href.href, true);
    }
  } catch {}
}
