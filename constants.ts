import { UserRole, ModuleStage, IdeationMode } from './types';

export const APP_TITLE = "Electronic Research Records";
export const APP_SUBTITLE = "AI-Driven End-to-End Automation of Clinical Research";

export const GEMINI_TEXT_MODEL = "gemini-2.5-flash";

export const USER_ROLES_CONFIG: { role: UserRole; description: string }[] = [
  { role: UserRole.HCP, description: "Initiate and conduct research projects." },
  { role: UserRole.RESEARCHER, description: "Provide mentorship and methodological input." },
  { role: UserRole.STATISTICIAN, description: "Define analysis plans and validate outputs." },
  { role: UserRole.DATA_ENGINEER, description: "Review and approve data queries, manage data access." },
  { role: UserRole.ADMIN, description: "Manage platform settings and users." },
];

export const IDEATION_MODE_CONFIG: { mode: IdeationMode; title: string; description: string; tooltip: string }[] = [
  {
    mode: IdeationMode.CLINICIAN_LED,
    title: IdeationMode.CLINICIAN_LED, // Using enum value directly for dropdown
    description: "", // Description can be part of tooltip or a short tagline if needed
    tooltip: "For healthcare professionals to input their initial ideas with AI providing suggestions and refinements."
  },
  {
    mode: IdeationMode.AI_CO_CREATION,
    title: IdeationMode.AI_CO_CREATION,
    description: "",
    tooltip: "For a more collaborative approach where the AI actively participates in brainstorming and shaping the idea."
  },
  {
    mode: IdeationMode.AUTONOMOUS_AI,
    title: IdeationMode.AUTONOMOUS_AI,
    description: "", // Consider "AI-Driven Hypothesis Generation" as an alternative title if preferred by UX
    tooltip: "AI proposes novel research ideas based on defined parameters or areas of interest."
  }
];


export const MODULE_STAGES_ORDERED: ModuleStage[] = [
  ModuleStage.IDEA_GENERATION,
  ModuleStage.PROPOSAL_DEVELOPMENT,
  ModuleStage.DATA_COLLECTION_ANALYSIS,
  ModuleStage.MANUSCRIPT_WRITING,
];

export const MOCK_USERS = [
  { id: "user_hcp_1", name: "Dr. Alice Smith", role: UserRole.HCP },
  { id: "user_researcher_1", name: "Prof. Bob Johnson", role: UserRole.RESEARCHER },
  { id: "user_statistician_1", name: "Dr. Carol White", role: UserRole.STATISTICIAN },
  { id: "user_data_engineer_1", name: "Mr. David Lee", role: UserRole.DATA_ENGINEER },
  { id: "user_admin_1", name: "Admin User", role: UserRole.ADMIN },
];

export const MOCK_KNOWLEDGE_BASES = {
  PUBMED_API_SIM: "Simulated PubMed API providing summaries of relevant medical literature.",
  INSTITUTIONAL_GUIDELINES_SIM: "Simulated Institutional Research Guidelines for proposal development and ethics.",
  JOURNAL_DATABASE_SIM: "Simulated database of journal aims, scopes, and impact factors."
};

export const EXTERNAL_LEARNING_RESOURCES = [
  { 
    title: "BMJ Research to Publication", 
    description: "A comprehensive program for healthcare professionals on planning, conducting, writing, and publishing research.",
    link: "https://rtop.bmj.com/",
    source: "BMJ"
  },
  {
    title: "NIH Introduction to the Principles and Practice of Clinical Research",
    description: "An online course from the U.S. National Institutes of Health covering the basics of clinical research.",
    link: "https://ocr.od.nih.gov/courses/ippcr.html",
    source: "NIH"
  },
  {
    title: "WHO Research Methodology Resources",
    description: "Guidance and tools from the World Health Organization for conducting health research, particularly in global health contexts.",
    link: "https://www.who.int/tdr/publications/topic/research-methodology/en/",
    source: "WHO"
  },
  {
    title: "From Research to Publication in 14 Steps",
    description: "A concise video outlining the 14 key steps of the academic publishing journey, from initial research to final publication.",
    link: "https://www.youtube.com/watch?v=A8EINvlnktw",
    source: "YouTube"
  }
];

export const PLATFORM_INTEGRATED_COURSES = [
  {
    title: "How Research Works: From Idea to Electronic Record",
    description: "Learn the fundamentals of contemporary research methodology integrated with platform tools.",
    duration: "45 mins",
    isPlatformIntegrated: true,
  },
  {
    title: "Efficient Proposal Development with Electronic Research Records",
    description: "Utilize AI assistance and institutional precedent comparison for rapid proposal drafting.",
    duration: "1 hour",
    isPlatformIntegrated: true,
  },
  {
    title: "Data Lifecycle with Electronic Research Records: From Query to Analysis",
    description: "Navigate AI-driven data collection and statistical analysis within the platform.",
    duration: "1.5 hours",
    isPlatformIntegrated: true,
  },
  {
    title: "Manuscript Crafting & Publication via Electronic Research Records",
    description: "Leverage AI for drafting, refining, and strategizing manuscript submission.",
    duration: "1 hour",
    isPlatformIntegrated: true,
  }
];