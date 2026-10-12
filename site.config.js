/*
 * ============================================================
 *  SITE SETTINGS — BMW & MINI of Manhattan (Worldwide BDC)
 * ============================================================
 *  This one file controls the site's tabs, the order of sections,
 *  the banner images, and the links at the top.
 *
 *  To change the WORDS on a section, edit its .md file in /content
 *  (the "file" listed below). You don't need to touch any code.
 *
 *  To ADD a section:  create a new .md file in /content, then add a
 *                     line for it under the right tab below.
 *  To ADD a tab:      copy one of the { id: ..., sections: [...] } blocks.
 *  To REMOVE something: delete its line.
 * ============================================================
 */
window.SITE = {
  title: "BMW & MINI of Manhattan",
  subtitle: "Service & Scheduling Guide",
  footer: "Property of Worldwide BDC Company · © 2021 all rights reserved",
  footerLogo: "https://www.worldwidebdc.com/wp-content/uploads/2021/06/Worldwide-logo-png-768x132.png",

  // Clock shown at the top (dealership time zone)
  timeZone: "America/New_York",

  // Where the "Edit" buttons point. After you put this site on GitHub,
  // replace with your repo, e.g. "https://github.com/worldwidebdc/bmw-site"
  // (leave "" to hide the Edit buttons)
  githubRepo: "https://github.com/jordanlandreneau/bmw-site",
  githubBranch: "main",

  // Crisp live-chat widget (was on the old site). Set to "" to turn it off.
  crispWebsiteId: "54916e80-3c6a-44a3-8888-d064efd8918d",

  // Rotating banner images at the top of the Main tab. Add/remove image links.
  banners: [
    "https://di-uploads-pod19.dealerinspire.com/bmwofmanhattan/uploads/2023/01/BMW-Manhattan-Oil-Services-CTA-Change-2.jpg",
    "https://di-uploads-development.dealerinspire.com/dibrandhubbmw/uploads/2024/08/PUSH_BMW_August_2024_Summer_Sales_iX_xDrive_699_1900x776_Desktop.jpg",
    "https://di-uploads-development.dealerinspire.com/dibrandhubbmw/uploads/2024/08/PUSH_BMW_August_2024_Summer_Sales_ICE_Credit_Offer_1900x776_Desktop.jpg",
    "https://di-uploads-development.dealerinspire.com/dibrandhubbmw/uploads/2024/08/PUSH_BMW_Certified_August_2024_1900x776_Desktop.jpg"
  ],

  // ---------- TABS & SECTIONS ----------
  // id      = short name used in the web address (no spaces)
  // label   = what people see in the menu
  // file    = the content file in /content
  // style   = optional look: "alert" (red/black warning box), "logins" (login cards)
  // collapsible = true turns each "## Heading" inside the file into a click-to-open panel
  tabs: [
    {
      id: "main",
      label: "Main",
      showBanners: true,
      sections: [
        { id: "logins",      label: "Logins",      file: "main/logins.md", style: "logins" },
        { id: "hours",       label: "Hours",       file: "main/hours.md" },
        { id: "important",   label: "Important",   file: "main/important.md", style: "alert" },
        { id: "checklist",   label: "Checklist",   file: "main/checklist.md" },
        { id: "drop-off",    label: "Drop Off",    file: "main/drop-off.md" },
        { id: "pick-up",     label: "Pick Up",     file: "main/pick-up.md" },
        { id: "emergencies", label: "Emergencies", file: "main/emergencies.md" },
        { id: "loaners",     label: "Loaners",     file: "main/loaners.md" },
        { id: "valet",       label: "Valet",       file: "main/valet.md" },
        { id: "warranty",    label: "Warranty",    file: "main/warranty.md" },
        { id: "lease",       label: "Lease",       file: "main/lease.md" },
        { id: "services",    label: "Services",    file: "main/services.md" },
        { id: "directory",   label: "Directory",   file: "main/directory.md", collapsible: true },
        { id: "bmw-codes",   label: "BMW Codes",   file: "main/bmw-codes.md" }
      ]
    },
    {
      id: "teleservice",
      label: "Teleservice",
      sections: [
        { id: "tele-logins",     label: "Logins",          file: "teleservice/logins.md", style: "logins" },
        { id: "guidelines",      label: "Guidelines",      file: "teleservice/guidelines.md" },
        { id: "types-of-leads",  label: "Types of Leads",  file: "teleservice/types-of-leads.md" },
        { id: "how-to-handle",   label: "How to Handle",   file: "teleservice/how-to-handle.md" },
        { id: "scripts",         label: "Email/Text Scripts", file: "teleservice/scripts.md" }
      ]
    },
    {
      id: "mdl-automation",
      label: "MDL Automation",
      sections: [
        { id: "mdl-login", label: "MDL Login", file: "mdl-automation/login.md", style: "logins" }
      ]
    }
  ]
};
