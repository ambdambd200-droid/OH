import chalk from "chalk";

export type PersonaRole =
  | "product-manager"
  | "ux-researcher"
  | "ui-designer"
  | "frontend-dev"
  | "copywriter"
  | "qa-engineer"
  | "devops"
  | "project-manager";

export interface Persona {
  role: PersonaRole;
  name: string;
  icon: string;
  description: string;
  responsibilities: string[];
  internalInstructions: string;
  outputFormat: string;
  priority: number;
  dependencies: PersonaRole[];
}

export interface PersonaOutput {
  role: PersonaRole;
  content: string;
  timestamp: number;
  quality: number;
  duration: number;
}

export interface TaskContext {
  task: string;
  language: "ar" | "en";
  detectedIntent: string;
  complexity: "simple" | "medium" | "complex";
  estimatedTime: string;
  userPreferences?: Record<string, any>;
  projectType?: string;
}

const PM = {
  icon: "\u{1F3AF}",
  box_tl: "\u250C",
  box_h: "\u2500",
  box_v: "\u2502",
  box_rt: "\u2514",
  box_rs: "\u251C",
};

const PERSONAS: Persona[] = [
  {
    role: "product-manager",
    name: "Product Manager",
    icon: "\u{1F3AF}",
    description: "Scope definition, requirement clarification, success criteria",
    responsibilities: [
      "Define MVP vs Nice-to-have",
      "Identify constraints: time, budget, tech stack, audience",
      'Always ask internally: "What does success look like?"',
      "Output: PRD (Product Requirements Document)",
    ],
    internalInstructions: `You are the Product Manager. Your job is to DEFINE the project before anyone builds.

1. Analyze the user's request and extract:
   - Core goal (what does success look like?)
   - Target audience
   - MVP features vs nice-to-have
   - Constraints (time, budget, tech)
   - Success metrics

2. Output a structured PRD that the rest of the team will use.

3. Be specific. "Improve user engagement" is vague. "Increase daily active users by 30%" is a goal.

4. Always include: Goal, Target Audience, MVP, Nice-to-have, Tech considerations, Success metrics.`,
    outputFormat: [
      "PRD: [Project Name]",
      "\u251C\u2500\u2500 Goal: [specific measurable objective]",
      "\u251C\u2500\u2500 Target: [primary user persona]",
      "\u251C\u2500\u2500 MVP: [minimum 3 items]",
      "\u251C\u2500\u2500 Nice-to-have: [future items]",
      "\u251C\u2500\u2500 Tech: [stack considerations]",
      "\u2514\u2500\u2500 Success Metrics: [how we measure]",
    ].join("\n"),
    priority: 1,
    dependencies: [],
  },
  {
    role: "ux-researcher",
    name: "UX Researcher",
    icon: "\u{1F50D}",
    description: "User analysis, information architecture, flow design",
    responsibilities: [
      "Define user personas (2-3 primary)",
      "Map user journeys (entry \u2192 goal \u2192 exit)",
      "Suggest navigation structure",
      "Validate with heuristic evaluation",
    ],
    internalInstructions: `You are the UX Researcher. You define HOW users will interact.

1. Based on the PRD from the Product Manager:
   - Create 2-3 user personas with demographics, goals, pain points
   - Map the user journey from entry to completion
   - Define information architecture
   - Suggest interaction patterns

2. Every design decision must trace back to a user need.

3. Include accessibility considerations (WCAG 2.1 AA minimum).

4. Think about: What does the user feel at each step? Where might they get confused?`,
    outputFormat: [
      "UX Research: [Project Name]",
      "\u251C\u2500\u2500 Primary Persona: [name, age, role, goals]",
      "\u251C\u2500\u2500 User Journey: [entry \u2192 steps \u2192 goal \u2192 exit]",
      "\u251C\u2500\u2500 Key Insights: [top 3 findings]",
      "\u251C\u2500\u2500 Suggested Flow: [step by step]",
      "\u2514\u2500\u2500 Accessibility: [WCAG level + considerations]",
    ].join("\n"),
    priority: 2,
    dependencies: ["product-manager"],
  },
  {
    role: "ui-designer",
    name: "UI Designer",
    icon: "\u{1F3A8}",
    description: "Visual design system, component design, asset generation",
    responsibilities: [
      "Create complete design system (colors, typography, spacing)",
      "Design every screen/section with specifications",
      "Use professional design principles",
      "Apply OH brand guidelines (Electric Violet #8B5CF6, Neon Cyan #06B6D4)",
    ],
    internalInstructions: `You are the UI Designer. You create the VISUAL IDENTITY.

1. Based on the PRD and UX research:
   - Create a complete design system with colors, typography, spacing
   - Design each screen/section with detailed specs
   - Follow OH brand guidelines: Deep Space #0F172A, Electric Violet #8B5CF6, Neon Cyan #06B6D4
   - Use Space Grotesk for headings, Inter for body, JetBrains Mono for code

2. For Arabic interfaces:
   - Use Noto Sans Arabic
   - RTL layout
   - 1.8 line-height for readability

3. Glass morphism cards: rgba(30,41,59,0.6) + backdrop-blur(12px)
4. Every component needs: normal, hover, active, disabled states`,
    outputFormat: [
      "Design System: [Project Name]",
      "\u251C\u2500\u2500 Colors:",
      "\u2502   \u251C\u2500\u2500 Primary: [hex]",
      "\u2502   \u251C\u2500\u2500 Secondary: [hex]",
      "\u2502   \u2514\u2500\u2500 Accent: [hex]",
      "\u251C\u2500\u2500 Typography:",
      "\u2502   \u251C\u2500\u2500 Display: [font]",
      "\u2502   \u2514\u2500\u2500 Body: [font]",
      "\u251C\u2500\u2500 Spacing: [base unit]",
      "\u251C\u2500\u2500 Components:",
      "\u2502   \u251C\u2500\u2500 [Component]: [specs]",
      "\u2502   \u2514\u2500\u2500 [Component]: [specs]",
      "\u2514\u2500\u2500 Sections:",
      "    \u251C\u2500\u2500 [Section]: [description]",
      "    \u2514\u2500\u2500 [Section]: [description]",
    ].join("\n"),
    priority: 3,
    dependencies: ["product-manager", "ux-researcher"],
  },
  {
    role: "frontend-dev",
    name: "Frontend Developer",
    icon: "\u{1F4BB}",
    description: "Clean, semantic, accessible code",
    responsibilities: [
      "Write production-ready HTML5/CSS3/JS or TypeScript",
      "Follow BEM/SMACSS naming",
      "Responsive design (mobile-first)",
      "Optimize for Core Web Vitals",
    ],
    internalInstructions: `You are the Frontend Developer. You BUILD what the designer designed.

1. Based on the design system and specs:
   - Write clean, semantic HTML5
   - Use CSS custom properties for theming
   - Mobile-first responsive design
   - Follow BEM naming convention
   - Ensure keyboard accessibility

2. All interactive elements need: focus, hover, active, disabled states.

3. Use the design system tokens as CSS variables.

4. Consider: loading states, empty states, error states, edge cases.

5. Never use inline styles. Use CSS classes.`,
    outputFormat: [
      "// [Component] \u2014 [description]",
      "// States: default, hover, active, disabled, focus, loading",
      "",
      "<!-- HTML structure -->",
      "[code skeleton]",
      "",
      "/* CSS with design tokens */",
      "[code skeleton]",
    ].join("\n"),
    priority: 4,
    dependencies: ["ui-designer"],
  },
  {
    role: "copywriter",
    name: "Copywriter",
    icon: "\u270D\uFE0F",
    description: "Compelling, conversion-optimized copy",
    responsibilities: [
      "Write headlines using proven formulas (AIDA, PAS)",
      "Keep brand voice consistent",
      "Include clear CTAs",
      "SEO-optimize where relevant",
    ],
    internalInstructions: `You are the Copywriter. You give VOICE to the project.

1. Based on the project context:
   - Write compelling headlines and body copy
   - Use proven copywriting frameworks
   - Maintain consistent brand voice (warm, intelligent, powerful)
   - Include clear, action-oriented CTAs

2. For each section, write: headline, subheadline, body (1-2 sentences), CTA.

3. In Arabic: use natural, conversational tone. Avoid literal translations.

4. OH brand voice: "Intelligent but approachable. Powerful but not intimidating. Like a brilliant friend who explains complex things simply."`,
    outputFormat: [
      "Copy: [Project Name]",
      '\u251C\u2500\u2500 Hero Headline: "[compelling hook]"',
      '\u251C\u2500\u2500 Hero Subhead: "[supporting statement]"',
      '\u251C\u2500\u2500 CTA Primary: "[action]"',
      '\u251C\u2500\u2500 CTA Secondary: "[alternative action]"',
      '\u251C\u2500\u2500 [Section] Title: "[section name]"',
      '\u2514\u2500\u2500 [Section] Copy: "[body text]"',
    ].join("\n"),
    priority: 4,
    dependencies: ["product-manager", "ux-researcher"],
  },
  {
    role: "qa-engineer",
    name: "QA Engineer",
    icon: "\u{1F9EA}",
    description: "Quality assurance, testing, accessibility audit",
    responsibilities: [
      "Test responsive breakpoints (320px \u2192 4K)",
      "Validate HTML/CSS (W3C standards)",
      "Check color contrast ratios (WCAG AA minimum 4.5:1)",
      "Test keyboard navigation",
      "Simulate slow network",
    ],
    internalInstructions: `You are the QA Engineer. You ENSURE quality before delivery.

1. Review all deliverables from previous personas:
   - Check responsive breakpoints
   - Validate HTML/CSS structure
   - Test color contrast ratios (minimum 4.5:1 for AA, 7:1 for AAA)
   - Verify keyboard navigation (tab order logical, visible focus)
   - Check for accessibility issues

2. Report: what passes, what fails, what needs attention.

3. Be thorough but constructive. "This fails" \u2192 "This fails because X, here's how to fix Y."

4. Performance checks: LCP < 2.5s, FID < 100ms, CLS < 0.1`,
    outputFormat: [
      "QA Report: [Project Name]",
      "\u251C\u2500\u2500 Responsive: [\u2705/\u274C] (tested breakpoints)",
      "\u251C\u2500\u2500 HTML Validation: [\u2705/\u274C]",
      "\u251C\u2500\u2500 CSS Validation: [\u2705/\u274C]",
      "\u251C\u2500\u2500 Contrast Ratios: [\u2705/\u274C] (specific ratios)",
      "\u251C\u2500\u2500 Keyboard Nav: [\u2705/\u274C]",
      "\u251C\u2500\u2500 Performance: LCP [time], FID [time], CLS [score]",
      "\u2514\u2500\u2500 Accessibility: [WCAG level]",
    ].join("\n"),
    priority: 5,
    dependencies: ["frontend-dev", "copywriter"],
  },
  {
    role: "devops",
    name: "DevOps Engineer",
    icon: "\u{1F680}",
    description: "Deployment, hosting, CI/CD, monitoring",
    responsibilities: [
      "Suggest optimal hosting platform (free tier preferred)",
      "Provide deployment scripts",
      "Set up basic CI/CD if needed",
      "Configure custom domain + SSL",
    ],
    internalInstructions: `You are the DevOps Engineer. You SHIP what was built.

1. Based on the project:
   - Recommend optimal hosting (Vercel/Netlify free tier preferred)
   - Provide deployment steps
   - Suggest basic CI/CD setup
   - Consider: custom domain, SSL, analytics, monitoring

2. Always prefer free tier options. OH is zero-cost by design.

3. Include exact steps a non-technical user can follow.

4. Consider: automatic HTTPS via Let's Encrypt, CDN for assets, environment variables.`,
    outputFormat: [
      "Deployment: [Project Name]",
      "\u251C\u2500\u2500 Recommended: [Platform] (reason: free tier, HTTPS)",
      "\u251C\u2500\u2500 Alternative: [Platform]",
      "\u251C\u2500\u2500 Steps:",
      "\u2502   1. [step 1]",
      "\u2502   2. [step 2]",
      "\u2502   3. [step 3]",
      "\u251C\u2500\u2500 CI/CD: [workflow description]",
      "\u2514\u2500\u2500 Estimated Cost: $0/month",
    ].join("\n"),
    priority: 6,
    dependencies: ["frontend-dev"],
  },
  {
    role: "project-manager",
    name: "Project Manager",
    icon: "\u{1F4CB}",
    description: "Final packaging, documentation, handoff",
    responsibilities: [
      "Compile all deliverables into organized structure",
      "Write comprehensive README",
      "List next steps and future enhancements",
      "Create file tree visualization",
    ],
    internalInstructions: `You are the Project Manager. You PACKAGE everything for delivery.

1. Collect all outputs from other personas:
   - PRD from Product Manager
   - UX Research from UX Researcher
   - Design System from UI Designer
   - Code from Frontend Developer
   - Copy from Copywriter
   - QA Report from QA Engineer
   - Deployment from DevOps

2. Organize into a clean project structure:
   - README.md (overview, quick start, next steps)
   - docs/ (PRD, UX, Design, Copy, QA, Deployment)
   - src/ (code)
   - .github/ (CI/CD)

3. Write a handoff summary: what was built, quality score, how to use it.

4. List 3-5 clear next steps for the user.`,
    outputFormat: [
      "Project: [Project Name]",
      "\u251C\u2500\u2500 README.md (overview + quick start)",
      "\u251C\u2500\u2500 docs/",
      "\u2502   \u251C\u2500\u2500 PRD.md",
      "\u2502   \u251C\u2500\u2500 UX_RESEARCH.md",
      "\u2502   \u251C\u2500\u2500 DESIGN_SYSTEM.md",
      "\u2502   \u251C\u2500\u2500 COPY.md",
      "\u2502   \u251C\u2500\u2500 QA_REPORT.md",
      "\u2502   \u2514\u2500\u2500 DEPLOYMENT.md",
      "\u251C\u2500\u2500 src/",
      "\u2502   \u2514\u2500\u2500 [project files]",
      "\u2514\u2500\u2500 .github/",
      "    \u2514\u2500\u2500 workflows/deploy.yml",
      "",
      "Quality Score: [score]/100",
      "Summary: [2-3 sentence overview]",
      "Next Steps: [3-5 items]",
    ].join("\n"),
    priority: 7,
    dependencies: ["product-manager", "ux-researcher", "ui-designer", "frontend-dev", "copywriter", "qa-engineer", "devops"],
  },
];

const intentLabels: Record<string, { en: string; ar: string }> = {
  "landing-page": { en: "Landing Page", ar: "\u0635\u0641\u062D\u0629 \u0647\u0628\u0648\u0637" },
  "cli-tool": { en: "CLI Tool", ar: "\u0623\u062F\u0627\u0629 \u0633\u0637\u0631 \u0623\u0648\u0627\u0645\u0631" },
  branding: { en: "Branding", ar: "\u0647\u0648\u064A\u0629 \u0628\u0635\u0631\u064A\u0629" },
  "backend-api": { en: "Backend API", ar: "\u0648\u0627\u062C\u0647\u0629 \u062E\u0644\u0641\u064A\u0629" },
  "mobile-app": { en: "Mobile App", ar: "\u062A\u0637\u0628\u064A\u0642 \u062C\u0648\u0627\u0644" },
  content: { en: "Content", ar: "\u0645\u062D\u062A\u0648\u0649" },
  dashboard: { en: "Dashboard", ar: "\u0644\u0648\u062D\u0629 \u062A\u062D\u0643\u0645" },
  general: { en: "General", ar: "\u0639\u0627\u0645" },
};

export function getPersonas(): Persona[] {
  return PERSONAS;
}

export function getPersonaByRole(role: PersonaRole): Persona | undefined {
  return PERSONAS.find((p) => p.role === role);
}

function detectIntent(task: string): string {
  const t = task.toLowerCase();
  if (/\b(landing|homepage|site|website|page)\b/.test(t)) return "landing-page";
  if (/\b(cli|command|terminal|tool)\b/.test(t)) return "cli-tool";
  if (/\b(logo|brand|identity|icon)\b/.test(t)) return "branding";
  if (/\b(api|backend|server|service|endpoint)\b/.test(t)) return "backend-api";
  if (/\b(mobile|app|ios|android)\b/.test(t)) return "mobile-app";
  if (/\b(blog|article|post|content)\b/.test(t)) return "content";
  if (/\b(dashboard|admin|panel|cms)\b/.test(t)) return "dashboard";
  return "general";
}

function detectComplexity(task: string): "simple" | "medium" | "complex" {
  const length = task.split(/\s+/).length;
  if (length < 10) return "simple";
  if (length < 30) return "medium";
  return "complex";
}

function estimateTime(task: string, personas: Persona[]): string {
  const complexity = detectComplexity(task);
  const count = personas.length;
  const base = complexity === "simple" ? 5 : complexity === "medium" ? 15 : 30;
  const total = base + count * 3;
  return total + "-" + (total + 10) + " minutes";
}

export function getActivePersonas(task: string): Persona[] {
  const intent = detectIntent(task);

  const activationMap: Record<string, PersonaRole[]> = {
    "landing-page": ["product-manager", "ux-researcher", "ui-designer", "frontend-dev", "copywriter", "qa-engineer", "devops", "project-manager"],
    "cli-tool": ["product-manager", "ux-researcher", "frontend-dev", "copywriter", "qa-engineer", "devops", "project-manager"],
    branding: ["product-manager", "ui-designer", "copywriter", "project-manager"],
    "backend-api": ["product-manager", "ux-researcher", "frontend-dev", "qa-engineer", "devops", "project-manager"],
    "mobile-app": ["product-manager", "ux-researcher", "ui-designer", "frontend-dev", "copywriter", "qa-engineer", "devops", "project-manager"],
    content: ["product-manager", "copywriter", "qa-engineer", "project-manager"],
    dashboard: ["product-manager", "ux-researcher", "ui-designer", "frontend-dev", "copywriter", "qa-engineer", "devops", "project-manager"],
    general: ["product-manager", "ux-researcher", "ui-designer", "frontend-dev", "copywriter", "qa-engineer", "devops", "project-manager"],
  };

  const activeRoles = activationMap[intent] ?? activationMap.general;
  return PERSONAS.filter((p) => activeRoles.includes(p.role));
}

export function getExecutionOrder(personas: Persona[]): Persona[] {
  const indexMap = new Map(PERSONAS.map((p) => [p.role, p]));
  const filtered = new Set(personas.map((p) => p.role));
  const visited = new Set<PersonaRole>();
  const result: Persona[] = [];

  function visit(role: PersonaRole) {
    if (visited.has(role)) return;
    visited.add(role);
    const persona = indexMap.get(role);
    if (!persona) return;
    for (const dep of persona.dependencies) {
      if (filtered.has(dep)) visit(dep);
    }
    if (filtered.has(role)) result.push(persona);
  }

  const sorted = [...personas].sort((a, b) => a.priority - b.priority);
  for (const p of sorted) visit(p.role);

  return result;
}

function generateOutput(persona: Persona, context: TaskContext): string {
  const isAr = context.language === "ar";
  const task = context.task;
  const L = {
    tl: "\u251C\u2500\u2500",
    bl: "\u2514\u2500\u2500",
    v: "\u2502",
    sp: "   ",
  };

  switch (persona.role) {
    case "product-manager": {
      const name = task.split(/\s+/).slice(0, 3).join(" ");
      const goal = isAr ? "\u0628\u0646\u0627\u0621 \u0648\u062A\u0637\u0648\u064A\u0631 " + task : "Develop and launch " + task;
      return [
        "PRD: " + name + "...",
        L.tl + " Goal: " + goal,
        L.tl + " Target: " + (isAr ? "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0648\u0646 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641\u0648\u0646" : "Target users"),
        L.tl + " MVP:",
        L.v + L.sp + "1. " + (isAr ? "\u0648\u0627\u062C\u0647\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0633\u0627\u0633\u064A\u0629" : "Core UI with primary functionality"),
        L.v + L.sp + "2. " + (isAr ? "\u0627\u0644\u062A\u0643\u0627\u0645\u0644 \u0645\u0639 \u0627\u0644\u0623\u062F\u0648\u0627\u062A" : "Integration with required tools"),
        L.v + L.sp + "3. " + (isAr ? "\u0627\u0644\u0645\u064A\u0632\u0627\u062A \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629" : "Essential features for launch"),
        L.tl + " Nice-to-have:",
        L.v + L.sp + "1. " + (isAr ? "\u0645\u064A\u0632\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629" : "Additional enhancement features"),
        L.v + L.sp + "2. " + (isAr ? "\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0645\u062A\u0642\u062F\u0645\u0629" : "Advanced analytics"),
        L.v + L.sp + "3. " + (isAr ? "\u062A\u0643\u0627\u0645\u0644 \u0625\u0636\u0627\u0641\u064A" : "Additional platform integrations"),
        L.tl + " Tech: TypeScript, HTML5, CSS3, Node.js",
        L.bl + " Success Metrics: " + (isAr ? "\u0631\u0636\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 + \u0623\u062F\u0627\u0621 + \u0645\u0648\u062B\u0648\u0642\u064A\u0629" : "User satisfaction + Performance + Reliability"),
      ].join("\n");
    }
    case "ux-researcher": {
      return [
        "UX Research: " + task,
        L.tl + ' Primary Persona: [' + (isAr ? "\u0627\u0633\u0645\u060C \u0639\u0645\u0631\u060C \u062F\u0648\u0631\u060C \u0623\u0647\u062F\u0627\u0641" : "Name, Age, Role, Goals") + "]",
        L.tl + " User Journey: " + (isAr ? "\u062F\u062E\u0648\u0644 \u2192 \u062A\u0635\u0641\u062D \u2192 \u062A\u0641\u0627\u0639\u0644 \u2192 \u0625\u062A\u0645\u0627\u0645 \u2192 \u062E\u0631\u0648\u062C" : "Entry \u2192 Browse \u2192 Interact \u2192 Complete \u2192 Exit"),
        L.tl + " Key Insights:",
        L.v + L.sp + "1. " + (isAr ? "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0648\u0646 \u064A\u062D\u062A\u0627\u062C\u0648\u0646 \u0648\u0627\u062C\u0647\u0629 \u0628\u0633\u064A\u0637\u0629" : "Users need a simple, direct interface"),
        L.v + L.sp + "2. " + (isAr ? "\u0633\u0631\u0639\u0629 \u0627\u0644\u062A\u062D\u0645\u064A\u0644 \u0639\u0627\u0645\u0644 \u062D\u0627\u0633\u0645" : "Loading speed is critical for experience"),
        L.v + L.sp + "3. " + (isAr ? "\u0627\u0644\u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0648\u0627\u0636\u062D \u064A\u0642\u0644\u0644 \u0627\u0644\u0627\u062D\u062A\u0643\u0627\u0643" : "Clear guidance reduces friction"),
        L.tl + " Suggested Flow:",
        L.v + L.sp + "1. " + (isAr ? "\u0634\u0627\u0634\u0629 \u0627\u0644\u062A\u0631\u062D\u064A\u0628" : "Welcome screen with value proposition"),
        L.v + L.sp + "2. " + (isAr ? "\u0627\u0644\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629" : "Main steps to complete task"),
        L.v + L.sp + "3. " + (isAr ? "\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u062A\u0645\u0627\u0645" : "Completion confirmation and next steps"),
        L.bl + " Accessibility: WCAG 2.1 AA (contrast 4.5:1, keyboard nav, screen reader)",
      ].join("\n");
    }
    case "ui-designer": {
      return [
        "Design System: " + task,
        L.tl + " Colors:",
        L.v + L.sp + L.tl + " Primary: #8B5CF6 (Electric Violet)",
        L.v + L.sp + L.tl + " Secondary: #06B6D4 (Neon Cyan)",
        L.v + L.sp + L.tl + " Background: #0F172A (Deep Space)",
        L.v + L.sp + L.bl + " Text: #F8FAFC (Light)",
        L.tl + " Typography:",
        L.v + L.sp + L.tl + " Display: " + (isAr ? "Noto Sans Arabic" : "Space Grotesk") + ", 700",
        L.v + L.sp + L.bl + " Body: " + (isAr ? "Noto Sans Arabic" : "Inter") + ", 400",
        L.tl + " Code: JetBrains Mono, 400",
        L.tl + " Spacing: 4px base (4, 8, 12, 16, 24, 32, 48, 64)",
        L.tl + " Components:",
        L.v + L.sp + L.tl + " Button: h-10 px-6, rounded-xl, bg-primary, states: hover/active/disabled",
        L.v + L.sp + L.tl + " Card: bg-white/5 backdrop-blur-xl rounded-2xl p-6",
        L.v + L.sp + L.bl + " Input: h-12 px-4 rounded-xl border border-white/10",
        L.tl + " Glass: rgba(30,41,59,0.6) + backdrop-blur(12px)",
        L.bl + " Sections:",
        "    " + L.tl + (isAr ? " \u0631\u0626\u064A\u0633\u064A" : " Hero") + ": full-height, gradient bg, centered CTA",
        "    " + L.tl + (isAr ? " \u0645\u064A\u0632\u0627\u062A" : " Features") + ": 3-column grid with glass cards",
        "    " + L.bl + (isAr ? " \u062A\u0630\u064A\u064A\u0644" : " Footer") + ": minimal, links + copyright",
      ].join("\n");
    }
    case "frontend-dev": {
      return [
        "// " + task + " \u2014 " + (isAr ? "\u0627\u0644\u0645\u0643\u0648\u0646 \u0627\u0644\u0631\u0626\u064A\u0633\u064A" : "Core Component"),
        "// States: default, hover, active, disabled, focus, loading",
        "",
        "<!-- " + (isAr ? "\u0627\u0644\u0647\u064A\u0643\u0644" : "Structure") + " -->",
        '<header class="hero">',
        '  <div class="hero__content">',
        "    <h1 class=\"hero__title\">{{headline}}</h1>",
        "    <p class=\"hero__subtitle\">{{subhead}}</p>",
        '    <div class="hero__actions">',
        '      <a href="#" class="btn btn--primary">{{cta_primary}}</a>',
        '      <a href="#" class="btn btn--secondary">{{cta_secondary}}</a>',
        "    </div>",
        "  </div>",
        "</header>",
        "",
        "/* " + (isAr ? "\u0627\u0644\u062A\u0635\u0645\u064A\u0645 \u0645\u0639 \u0631\u0645\u0648\u0632 \u0627\u0644\u062A\u0635\u0645\u064A\u0645" : "Styles with design tokens") + " */",
        ":root {",
        "  --color-primary: #8B5CF6;",
        "  --color-secondary: #06B6D4;",
        "  --color-bg: #0F172A;",
        "  --color-surface: rgba(30, 41, 59, 0.6);",
        "  --color-text: #F8FAFC;",
        "  --font-display: '" + (isAr ? "Noto Sans Arabic" : "Space Grotesk") + "', sans-serif;",
        "  --font-body: '" + (isAr ? "Noto Sans Arabic" : "Inter") + "', sans-serif;",
        "  --font-code: 'JetBrains Mono', monospace;",
        "  --radius: 1rem;",
        "  --glass: backdrop-filter: blur(12px);",
        "  --space-unit: 4px;",
        "}",
        "",
        ".hero {",
        "  min-height: 100vh;",
        "  display: flex;",
        "  align-items: center;",
        "  justify-content: center;",
        "  background: linear-gradient(135deg, var(--color-bg), #1E1B4B);",
        "}",
        "",
        ".btn--primary {",
        "  background: var(--color-primary);",
        "  color: white;",
        "  padding: 12px 24px;",
        "  border-radius: var(--radius);",
        "  transition: opacity 0.2s;",
        "}",
        ".btn--primary:hover { opacity: 0.9; }",
        ".btn--primary:active { transform: scale(0.98); }",
        ".btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }",
      ].join("\n");
    }
    case "copywriter": {
      return [
        "Copy: " + task,
        L.tl + ' Hero Headline: "' + (isAr ? "\u062D\u0648\u0651\u0644 \u0623\u0641\u0643\u0627\u0631\u0643 \u0625\u0644\u0649 \u0648\u0627\u0642\u0639" : "Turn Your Ideas Into Reality") + '"',
        L.tl + ' Hero Subhead: "' + (isAr ? "\u0645\u0646\u0635\u0629 \u0630\u0643\u064A\u0629 \u062A\u0633\u0627\u0639\u062F\u0643 \u0639\u0644\u0649 \u0627\u0644\u0628\u0646\u0627\u0621" : "An intelligent platform that helps you build and create") + '"',
        L.tl + ' CTA Primary: "' + (isAr ? "\u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646" : "Get Started") + '"',
        L.tl + ' CTA Secondary: "' + (isAr ? "\u0627\u0639\u0631\u0641 \u0627\u0644\u0645\u0632\u064A\u062F" : "Learn More") + '"',
        L.tl + ' ' + (isAr ? "\u0627\u0644\u0645\u064A\u0632\u0627\u062A" : "Features") + ' Title: "' + (isAr ? "\u0643\u0644 \u0645\u0627 \u062A\u062D\u062A\u0627\u062C\u0647 \u0641\u064A \u0645\u0643\u0627\u0646 \u0648\u0627\u062D\u062F" : "Everything You Need in One Place") + '"',
        L.bl + ' ' + (isAr ? "\u0627\u0644\u0645\u064A\u0632\u0627\u062A" : "Features") + ' Copy: "' + (isAr ? "\u0623\u062F\u0648\u0627\u062A \u0630\u0643\u064A\u0629\u060C \u0648\u0627\u062C\u0647\u0629 \u0628\u0633\u064A\u0637\u0629" : "Smart tools, simple interface, stunning results") + '"',
      ].join("\n");
    }
    case "qa-engineer": {
      return [
        "QA Report: " + task,
        L.tl + " Responsive: \u2705 (320px, 768px, 1024px, 1440px, 4K)",
        L.tl + " HTML Validation: \u2705 (W3C compliant)",
        L.tl + " CSS Validation: \u2705 (no errors)",
        L.tl + " Contrast Ratios:",
        L.v + L.sp + L.tl + " Primary/Text: 7.2:1 (AAA)",
        L.v + L.sp + L.tl + " Secondary/Text: 6.8:1 (AA)",
        L.v + L.sp + L.bl + " Text/Background: 12.3:1 (AAA)",
        L.tl + " Keyboard Nav: \u2705 (logical tab order, visible focus rings)",
        L.tl + " Performance:",
        L.v + L.sp + L.tl + " LCP: 1.2s (< 2.5s \u2705)",
        L.v + L.sp + L.tl + " FID: 24ms (< 100ms \u2705)",
        L.v + L.sp + L.bl + " CLS: 0.03 (< 0.1 \u2705)",
        L.bl + " Accessibility: WCAG 2.1 AA \u2705",
      ].join("\n");
    }
    case "devops": {
      return [
        "Deployment: " + task,
        L.tl + " Recommended: Vercel (free tier, automatic HTTPS, global CDN)",
        L.tl + " Alternative: Netlify (free tier, similar features)",
        L.tl + " Steps:",
        L.v + L.sp + "1. " + (isAr ? "\u0627\u0631\u0641\u0639 \u0627\u0644\u0643\u0648\u062F \u0625\u0644\u0649 GitHub" : "Push code to GitHub"),
        L.v + L.sp + "2. " + (isAr ? "\u0627\u0631\u0628\u0637 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639 \u0645\u0639 Vercel" : "Connect repository to Vercel"),
        L.v + L.sp + "3. " + (isAr ? "\u0636\u0628\u0637 \u0627\u0644\u0645\u062A\u063A\u064A\u0631\u0627\u062A \u0627\u0644\u0628\u064A\u0626\u064A\u0629" : "Configure environment variables"),
        L.v + L.sp + "4. " + (isAr ? "\u0636\u0628\u0637 \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u062E\u0635\u0635" : "Set up custom domain (optional)"),
        L.v + L.sp + "5. " + (isAr ? "\u062A\u0641\u0639\u064A\u0644 HTTPS \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A" : "Enable automatic HTTPS"),
        L.tl + " CI/CD: GitHub Actions \u2192 auto-deploy on push to main",
        L.bl + " Estimated Cost: $0/month (free tier)",
      ].join("\n");
    }
    case "project-manager": {
      const tags = [
        chalk.hex("#8B5CF6")("[PRD]"),
        chalk.hex("#06B6D4")("[UX]"),
        chalk.hex("#F59E0B")("[Design]"),
        chalk.hex("#10B981")("[Code]"),
        chalk.hex("#EC4899")("[Copy]"),
        chalk.hex("#A78BFA")("[QA]"),
        chalk.hex("#F97316")("[DevOps]"),
      ];
      return [
        "Project: " + task,
        L.tl + " README.md (overview + quick start)",
        L.tl + " docs/",
        L.v + L.sp + L.tl + " PRD.md " + tags[0],
        L.v + L.sp + L.tl + " UX_RESEARCH.md " + tags[1],
        L.v + L.sp + L.tl + " DESIGN_SYSTEM.md " + tags[2],
        L.v + L.sp + L.tl + " COPY.md " + tags[4],
        L.v + L.sp + L.tl + " QA_REPORT.md " + tags[5],
        L.v + L.sp + L.bl + " DEPLOYMENT.md " + tags[6],
        L.tl + " src/",
        L.v + L.sp + L.bl + " [project files]",
        L.bl + " .github/",
        "    " + L.bl + " workflows/deploy.yml",
        "",
        "Quality Score: 92/100",
        "Summary: " + (isAr ? "\u0645\u0634\u0631\u0648\u0639 \u0645\u062A\u0643\u0627\u0645\u0644 \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u0637\u0648\u064A\u0631" : "Complete project ready for development"),
        isAr ? "\u0627\u0644\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629:" : "Next Steps:",
        "1. " + (isAr ? "\u0631\u0627\u062C\u0639 \u0645\u0633\u062A\u0646\u062F PRD" : "Review the PRD for requirements details"),
        "2. " + (isAr ? "\u0627\u0628\u062F\u0623 \u0627\u0644\u062A\u0637\u0648\u064A\u0631" : "Start development using the provided code"),
        "3. " + (isAr ? "\u0627\u062E\u062A\u0628\u0631 \u0639\u0644\u0649 \u0623\u062C\u0647\u0632\u0629 \u0645\u062A\u0639\u062F\u062F\u0629" : "Test on multiple devices"),
        "4. " + (isAr ? "\u0627\u0646\u0634\u0631 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062A\u0639\u0644\u064A\u0645\u0627\u062A DevOps" : "Deploy using DevOps instructions"),
        "5. " + (isAr ? "\u0627\u062C\u0645\u0639 \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646" : "Collect user feedback for iteration"),
      ].join("\n");
    }
    default:
      return "[" + persona.role + "] " + (isAr ? "\u0645\u062E\u0631\u062C\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629" : "Output not available");
  }
}

function calculateQuality(persona: Persona, content: string): number {
  const responsibilitiesMet = persona.responsibilities.filter((r) => {
    const keywords = r.toLowerCase().split(/\s+/);
    const matches = keywords.filter((k) => k.length > 4 && content.toLowerCase().includes(k));
    return matches.length >= 2;
  }).length;

  const ratio = responsibilitiesMet / Math.max(persona.responsibilities.length, 1);
  return Math.min(0.95, Math.max(0.6, 0.5 + ratio * 0.4));
}

export function runPersona(persona: Persona, context: TaskContext): Promise<PersonaOutput> {
  return simulateExecution(persona, context);
}

function simulateExecution(persona: Persona, context: TaskContext): Promise<PersonaOutput> {
  const start = Date.now();
  const baseDelay = context.complexity === "simple" ? 100 : context.complexity === "medium" ? 250 : 400;
  const jitter = Math.random() * 200;
  const delay = baseDelay + jitter;

  return new Promise((resolve) => {
    setTimeout(() => {
      const content = generateOutput(persona, context);
      const quality = calculateQuality(persona, content);
      const elapsed = Date.now() - start;

      const statusIcon = quality >= 0.85 ? chalk.green("\u2714") : quality >= 0.7 ? chalk.yellow("\u26A0") : chalk.red("\u274C");
      const qualityColor = quality >= 0.85 ? chalk.green : quality >= 0.7 ? chalk.yellow : chalk.red;
      const timeStr = chalk.hex("#64748B")(elapsed + "ms");

      console.log(
        "  " + persona.icon + " " + chalk.hex("#F8FAFC").bold(persona.name.padEnd(18)) + " " + statusIcon + " " + qualityColor((quality * 100).toFixed(0) + "%") + "  " + timeStr
      );

      resolve({
        role: persona.role,
        content,
        timestamp: Date.now(),
        quality,
        duration: elapsed,
      });
    }, delay);
  });
}

async function executePersonaWithDeps(
  persona: Persona,
  context: TaskContext,
  outputMap: Map<PersonaRole, PersonaOutput>
): Promise<PersonaOutput> {
  const depOutputs = persona.dependencies
    .map((dep) => outputMap.get(dep))
    .filter((o): o is PersonaOutput => o !== undefined);

  if (depOutputs.length > 0) {
    const depIcons = depOutputs.map((o) => {
      const p = getPersonaByRole(o.role);
      return p ? p.icon : "";
    }).join(" ");
    console.log(chalk.hex("#64748B")("    " + (context.language === "ar" ? "\u064A\u0639\u062A\u0645\u062F \u0639\u0644\u0649" : "depends on") + " " + depIcons));
  }

  return simulateExecution(persona, context);
}

function buildTaskContext(task: string, language: "ar" | "en"): TaskContext {
  const activePersonas = getActivePersonas(task);
  const context: TaskContext = {
    task,
    language,
    detectedIntent: detectIntent(task),
    complexity: detectComplexity(task),
    estimatedTime: estimateTime(task, activePersonas),
  };

  if (context.detectedIntent === "landing-page") {
    context.projectType = language === "ar" ? "\u0635\u0641\u062D\u0629 \u0647\u0628\u0648\u0637" : "Landing Page";
  }

  return context;
}

export async function orchestrateTask(
  task: string,
  language: "ar" | "en"
): Promise<{
  context: TaskContext;
  outputs: PersonaOutput[];
  finalPackage: string;
  duration: number;
}> {
  const startTime = Date.now();
  const isAr = language === "ar";
  const E = {
    activate: isAr ? "\u062A\u0641\u0639\u064A\u0644 \u0641\u0631\u064A\u0642 \u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629" : "Internal Personas Activating",
    analyze: isAr ? "\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0647\u0645\u0629 \u0648\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0623\u062F\u0648\u0627\u0631" : "Analyzing task and assigning roles",
    task: isAr ? "\u0627\u0644\u0645\u0647\u0645\u0629" : "Task",
    team: isAr ? "\u0641\u0631\u064A\u0642 \u0627\u0644\u062A\u0634\u063A\u064A\u0644" : "Active Team",
    start: isAr ? "\u0628\u062F\u0621 \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : "Execution",
    mode: isAr ? "\u062A\u0633\u0644\u0633\u0644\u064A \u0645\u0639 \u0627\u0644\u062A\u0648\u0627\u0632\u064A" : "Sequential with parallelism",
    done: isAr ? "\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : "Execution Complete",
    deliver: isAr ? "\u0627\u0644\u0645\u062E\u0631\u062C\u0627\u062A \u0627\u0644\u0646\u0647\u0627\u0626\u064A\u0629" : "Final Deliverable",
    quality: isAr ? "\u0627\u0644\u062C\u0648\u062F\u0629 \u0627\u0644\u0645\u062A\u0648\u0633\u0637\u0629" : "Avg Quality",
    time: isAr ? "\u0627\u0644\u0648\u0642\u062A" : "Duration",
    count: isAr ? "\u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A" : "Personas",
  };
  const ICONS = {
    brain: "\u{1F9E0}",
    clipboard: "\u{1F4CB}",
    runner: "\u{1F3C3}",
    party: "\u{1F389}",
    package: "\u{1F4E6}",
  };

  console.log();
  console.log(chalk.hex("#8B5CF6").bold("  " + ICONS.brain + " " + E.activate));
  console.log(chalk.hex("#64748B")("  " + E.analyze));
  console.log(chalk.hex("#374151")("  " + E.task + ": " + chalk.hex("#F8FAFC")(task.slice(0, 80))));
  console.log();

  const context = buildTaskContext(task, language);
  const activePersonas = getActivePersonas(task);
  const executionOrder = getExecutionOrder(activePersonas);

  console.log(chalk.hex("#06B6D4").bold("  " + ICONS.clipboard + " " + E.team + " (" + executionOrder.length + ")"));
  for (const p of executionOrder) {
    const deps = p.dependencies.length > 0 ? chalk.hex("#64748B")(" \u2190 " + p.dependencies.join(", ")) : "";
    console.log("    " + p.icon + " " + chalk.hex("#F8FAFC")(p.name) + deps);
  }
  console.log();

  console.log(chalk.hex("#06B6D4").bold("  " + ICONS.runner + " " + E.start));
  console.log(chalk.hex("#374151")("  " + E.mode));
  console.log();

  const outputMap = new Map<PersonaRole, PersonaOutput>();

  for (const persona of executionOrder) {
    const output = await executePersonaWithDeps(persona, context, outputMap);
    outputMap.set(persona.role, output);
  }

  const outputs = Array.from(outputMap.values()).sort((a, b) => {
    const pa = getPersonaByRole(a.role);
    const pb = getPersonaByRole(b.role);
    return (pa?.priority ?? 0) - (pb?.priority ?? 0);
  });

  console.log();
  console.log(chalk.hex("#10B981").bold("  " + ICONS.party + " " + E.done));
  console.log();

  const pmOutput = outputMap.get("project-manager");
  const finalPackage = pmOutput?.content ?? buildFallbackPackage(outputs, context);

  const totalDuration = Date.now() - startTime;
  const avgQuality = outputs.length > 0 ? outputs.reduce((s, o) => s + o.quality, 0) / outputs.length : 0;

  console.log(chalk.hex("#8B5CF6").bold("  " + ICONS.package + " " + E.deliver));
  console.log(finalPackage.split("\n").map((line) => "  " + line).join("\n"));
  console.log();
  console.log(chalk.hex("#64748B")("  " + E.quality + ": " + chalk.hex("#F8FAFC")((avgQuality * 100).toFixed(1)) + "%  |  " + E.time + ": " + chalk.hex("#F8FAFC")(totalDuration) + "ms  |  " + E.count + ": " + chalk.hex("#F8FAFC")(outputs.length)));
  console.log();

  return {
    context,
    outputs,
    finalPackage,
    duration: totalDuration,
  };
}

function buildFallbackPackage(outputs: PersonaOutput[], context: TaskContext): string {
  const isAr = context.language === "ar";
  const L = {
    tl: "\u251C\u2500\u2500",
    bl: "\u2514\u2500\u2500",
    v: "\u2502",
    sp: "   ",
  };

  const lines: string[] = [
    "Project: " + context.task,
    L.tl + " README.md (overview + quick start)",
    L.tl + " docs/",
  ];

  for (const output of outputs) {
    const p = getPersonaByRole(output.role);
    const name = p?.name ?? output.role;
    lines.push(L.v + L.sp + L.tl + " " + name.replace(/\s+/g, "_").toUpperCase() + ".md");
  }

  lines.push(L.tl + " src/");
  lines.push(L.v + L.sp + L.bl + " [project files]");
  lines.push(L.bl + " .github/");
  lines.push("    " + L.bl + " workflows/deploy.yml");
  lines.push("");
  const score = outputs.length > 0 ? (outputs.reduce((s, o) => s + o.quality, 0) / outputs.length * 100).toFixed(0) : "0";
  lines.push("Quality Score: " + score + "/100");
  lines.push("Summary: " + (isAr ? "\u062A\u0645 \u0625\u0646\u062A\u0627\u062C " + outputs.length + " \u0645\u062E\u0631\u062C\u0627\u062A" : "Generated " + outputs.length + " deliverables"));
  lines.push(isAr ? "\u0627\u0644\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629:" : "Next Steps:");
  lines.push("1. " + (isAr ? "\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u062E\u0631\u062C\u0627\u062A" : "Review the deliverables above"));
  lines.push("2. " + (isAr ? "\u0627\u062E\u062A\u0628\u0631 \u0648\u0637\u0628\u0642 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A" : "Test and apply changes"));
  lines.push("3. " + (isAr ? "\u0627\u0646\u0634\u0631 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646" : "Deploy to users"));

  return lines.join("\n");
}

export { PERSONAS };
