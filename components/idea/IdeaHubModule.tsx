
import React, { useState, useCallback, useEffect } from 'react';
import { ModuleWrapper } from '../core/ModuleWrapper';
import { LightBulbIcon, SparklesIcon, PlayCircleIcon, BellIcon, Cog6ToothIcon, ChatBubbleLeftEllipsisIcon, ArrowTrendingUpIcon } from '../../assets/icons';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { TextInput } from '../shared/TextInput';
import { TextAreaInput } from '../shared/TextAreaInput';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useProject } from '../../contexts/ProjectContext';
import { ResearchIdea, AIReport, UserRole, ModuleStage, IdeationMode } from '../../types';
import { generateText, generateTextWithRAG, generateJsonOutput } from '../../services/geminiService';
import { MOCK_KNOWLEDGE_BASES, MOCK_USERS, IDEATION_MODE_CONFIG } from '../../constants';
import { InfoTooltip } from '../shared/InfoTooltip';
import { NotificationBanner } from '../shared/NotificationBanner';
import { ChatInterface } from '../core/ChatInterface';
import { useAuth } from '../../contexts/AuthContext';
import { Gauge } from '../shared/Gauge';
import { SelectionCard } from '../shared/SelectionCard';


export const IdeaHubModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    currentProject, 
    startNewProject, 
    updateIdea, 
    isLoading: projectLoading, 
    setIsLoading: setProjectLoading, 
    error: projectError, 
    setError: setProjectError,
    assignExpert,
    setProjectStage,
    clearError
  } = useProject();
  
  const [projectTitle, setProjectTitle] = useState('');
  const [ideaInput, setIdeaInput] = useState<Partial<ResearchIdea>>({ concept: '' });
  const [selectedIdeationMode, setSelectedIdeationMode] = useState<IdeationMode | null>(null);
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  
  // New states for search criteria
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>(['PubMed']);
  const [selectedLiteratureTypes, setSelectedLiteratureTypes] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState({ from: '', to: '' });

  // States for Spark Mode (AI Co-Creation)
  const [hcpProfile, setHcpProfile] = useState({ experience: '', specialty: '', interests: '' });
  // States for Insight Engine
  const [autonomousIdeas, setAutonomousIdeas] = useState<{id: string; question: string; rationale: string}[]>([]);
  const [selectedAutonomousIdea, setSelectedAutonomousIdea] = useState<string | null>(null);

  const databaseOptions = ['PubMed', 'Scopus', 'Google Scholar', 'Web of Science'];
  const literatureTypeOptions = ['Meta-analysis', 'Systematic Review', 'Randomized Controlled Trial (RCT)', 'Prospective Study', 'Retrospective Study', 'Case Report'];

  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  useEffect(() => {
    if (currentProject) {
        setProjectTitle(currentProject.title || '');
        if (currentProject.idea) {
            setIdeaInput(currentProject.idea);
            setSelectedIdeationMode(currentProject.idea.ideationMode || IdeationMode.CLINICIAN_LED); 
        } else {
            setIdeaInput({ concept: '' });
            setSelectedIdeationMode(IdeationMode.CLINICIAN_LED); 
        }
    } else {
      // Reset for no project
      setProjectTitle('');
      setIdeaInput({ concept: '' });
      setSelectedIdeationMode(IdeationMode.CLINICIAN_LED); 
    }
  }, [currentProject]);

  const handleModeSelect = (mode: IdeationMode) => {
    setSelectedIdeationMode(mode);
    if (currentProject) {
        updateIdea({ ideationMode: mode, aiReport: undefined, noveltyScore: undefined }); // Reset report when mode changes
    }
     setIdeaInput(prev => ({ ...prev, ideationMode: mode, aiReport: undefined, noveltyScore: undefined }));
    // Reset specific mode inputs if needed
    if (mode !== IdeationMode.AUTONOMOUS_AI) setSelectedAutonomousIdea(null);
    if (mode !== IdeationMode.AI_CO_CREATION) console.log("AI Co-Creation mode inputs could be reset here");
  };

  const handleInputChange = (field: keyof ResearchIdea, value: string) => {
    setIdeaInput(prev => ({ ...prev, [field]: value }));
  };

  const handleHcpProfileChange = (field: keyof typeof hcpProfile, value: string) => {
    setHcpProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleStartNewProject = () => {
    if (!projectTitle.trim()) {
      setProjectError("Project title cannot be empty.");
      return;
    }
    const modeToStart = selectedIdeationMode || IdeationMode.CLINICIAN_LED;
    startNewProject(projectTitle, { ideationMode: modeToStart });
    setIdeaInput({ concept: '', ideationMode: modeToStart });
    setNotification(null);
  };

  const validateIdeaAndGenerateReport = async () => {
    const currentModeTitle = IDEATION_MODE_CONFIG.find(m => m.mode === selectedIdeationMode)?.title || "the selected mode";
    if (!currentProject || (!ideaInput.concept?.trim() && selectedIdeationMode === IdeationMode.CLINICIAN_LED)) {
      setProjectError(`Please provide an initial research concept for ${currentModeTitle}.`);
      return;
    }
    
    setIsSearchingSources(true);
    setProjectLoading(false);
    clearError();
    const searchMessage = `Searching ${selectedDatabases.join(', ')} for ${selectedLiteratureTypes.length > 0 ? selectedLiteratureTypes.join(', ') : 'all literature types'} between ${yearRange.from || 'start'} and ${yearRange.to || 'present'}`;
    setNotification({ message: `Initiating literature search... (${searchMessage})`, type: 'info' });

    setTimeout(async () => {
        setIsSearchingSources(false);
        setProjectLoading(true);
        setNotification({ message: "AI is analyzing your idea...", type: 'info' });

        const ragContext = `Knowledge Base Context:
        - ${MOCK_KNOWLEDGE_BASES.PUBMED_API_SIM}
        - Trends: Increased interest in telehealth, AI in diagnostics.
        - Gaps: Long-term effects of new drug X, comparative effectiveness of Y vs Z.`;

        const systemInstruction = "You are an AI assistant specialized in clinical research ideation. Analyze the provided research concept against the knowledge base context. Provide a concise report in JSON format with fields: literatureSummary (string), researchGaps (string), noveltyScore (number 0-100, where 100 is highly novel), feasibilityAssessment (string, preliminary), aiSuggestions (string, actionable points for refinement, if applicable).";
        
        const searchCriteria = `
          Search Criteria:
          - Databases: ${selectedDatabases.join(', ')}
          - Prioritized Literature Types: ${selectedLiteratureTypes.length > 0 ? selectedLiteratureTypes.join(', ') : 'All types considered'}
          - Year Range: from ${yearRange.from || 'any'} to ${yearRange.to || 'present'}.`;

        const prompt = `Research Concept:
        Background: ${ideaInput.background || (selectedIdeationMode === IdeationMode.AUTONOMOUS_AI && ideaInput.concept ? ideaInput.background : 'Not provided')}
        Objective/Hypothesis: ${ideaInput.objective || 'Not provided'}
        Methodology Idea: ${ideaInput.methodology || 'Not provided'}
        Significance: ${ideaInput.significance || 'Not provided'}
        Expected Outcomes: ${ideaInput.expectedOutcomes || 'Not provided'}
        Core Concept: ${ideaInput.concept}
        ${searchCriteria}

        Analyze this concept using the provided knowledge base context and search criteria. Output must be JSON.`;

        type AIReportResponse = Omit<AIReport, 'noveltyRating'> & { noveltyScore: number; aiSuggestions?: string };

        const response = await generateJsonOutput<AIReportResponse>(`${ragContext}\n\n${prompt}`, systemInstruction);

        if (response.data) {
          const reportData: AIReport = { 
            ...response.data, 
            noveltyRating: response.data.noveltyScore > 80 ? "High" : response.data.noveltyScore > 60 ? "Medium" : "Low",
          };
          updateIdea({ 
              ...ideaInput, 
              aiReport: reportData, 
              noveltyScore: response.data.noveltyScore,
            });
          setNotification({ message: "AI analysis report generated successfully!", type: 'success' });

          if (response.data.noveltyScore >= 60) { 
            const researcher = MOCK_USERS.find(u => u.role === UserRole.RESEARCHER);
            if (researcher && currentProject && !currentProject.assignedResearcher) {
              assignExpert('researcher', researcher.id);
              setNotification({ message: `Potential idea! Experienced Researcher "${researcher.name}" has been notionally assigned. (12 hours allocated)`, type: 'info' });
            }
          }
        } else {
          setProjectError(response.error || "Failed to generate AI report. Raw output: " + response.rawText);
          setNotification({ message: `Error generating report: ${response.error || "Unknown error"}`, type: 'error' });
        }
        setProjectLoading(false);
    }, 3000); // 3-second delay
  };
  
  const handleAiCoCreation = async () => {
    if (!currentProject) {
        setProjectError("Please start a project first."); return;
    }
    if (!hcpProfile.specialty.trim() || !hcpProfile.interests.trim()) {
        setProjectError("Please provide your specialty and research interests for AI Co-Creation."); return;
    }
    const coCreationTitle = IDEATION_MODE_CONFIG.find(m => m.mode === IdeationMode.AI_CO_CREATION)?.title || "AI Co-Creation";
    setNotification({ message: `${coCreationTitle} initiated. Use the chat below.`, type: 'info'});
  };

  const handleLoadAutonomousIdeas = async () => {
     if (!currentProject) {
        setProjectError("Please start a project first to review AI-generated ideas in context."); return;
    }
    setProjectLoading(true); clearError(); setNotification(null);
    const systemInstruction = "You are an AI that generates novel research hypotheses by synthesizing diverse data sources (simulated). Generate three distinct novel research questions suitable for an HCP to investigate. Output as a JSON array: [{ 'id': 'idea_1', 'question': '...', 'rationale': '...' }, ...]";
    const prompt = `Simulated Data Sources Review:
    - Literature Trends: PubMed API (keywords: emerging diseases, treatment gaps, AI in medicine)
    - EHR Metadata (de-identified): Increased incidence of condition X in demographic Y. Correlation between factor A and outcome B.
    - Public Health Data: Outbreak of Z in region A.
    - News Feeds: Reports on environmental factor B. Technological advancements in area C.
    Generate three novel research questions.`;

    const response = await generateJsonOutput<{id: string; question: string; rationale: string}[]>(prompt, systemInstruction);
    if (response.data) {
        setAutonomousIdeas(response.data);
        setNotification({ message: `Loaded ${response.data.length} AI-generated idea suggestions.`, type: 'info' });
    } else {
        setProjectError(response.error || "Failed to load autonomous AI ideas.");
        setNotification({ message: `Error: ${response.error}`, type: 'error' });
    }
    setProjectLoading(false);
  };

  const handleSelectAutonomousIdea = (idea: {id: string; question: string; rationale: string}) => {
    setSelectedAutonomousIdea(idea.id);
    const autoIdeaForInput: Partial<ResearchIdea> = {
        concept: idea.question,
        background: idea.rationale,
        ideationMode: IdeationMode.AUTONOMOUS_AI,
        aiReport: undefined, 
        noveltyScore: undefined,
    };
    setIdeaInput(autoIdeaForInput);
     if (currentProject) { 
        updateIdea(autoIdeaForInput);
    }
    setNotification({message: `Selected AI Idea: "${idea.question}". You can now request an AI Analysis Report.`, type: 'info'});
  };

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const proceedToProposal = () => {
    if (currentProject && currentProject.idea ) {
        // AI Co-Creation mode might not require a formal AI report to proceed, as it's chat-based
        if (!currentProject.idea.aiReport && selectedIdeationMode !== IdeationMode.AI_CO_CREATION && !(selectedIdeationMode === IdeationMode.AUTONOMOUS_AI && selectedAutonomousIdea) ) {
             if (!currentProject.idea.aiReport && !(selectedIdeationMode === IdeationMode.AUTONOMOUS_AI && currentProject.idea.concept)) { // For Autonomous AI, ensure an idea concept is at least selected and populated.
                setProjectError("Please generate and review the AI Analysis Report for your selected idea before proceeding.");
                return;
             }
        }
        updateIdea({ isNovel: (currentProject.idea.noveltyScore || 0) >= 60 }); 
        setProjectStage(ModuleStage.PROPOSAL_DEVELOPMENT);
        setNotification({message: "Idea stage complete! Proceeding to Proposal Development.", type: 'success'});
    } else {
        setProjectError("Please select an ideation mode, develop an idea, and (if applicable) review its AI report before proceeding.");
    }
  };

  const isHCP = currentUser?.role === UserRole.HCP;

  const currentModeIcon = () => {
    switch(selectedIdeationMode) {
        case IdeationMode.CLINICIAN_LED: return <LightBulbIcon />;
        case IdeationMode.AI_CO_CREATION: return <ChatBubbleLeftEllipsisIcon />;
        case IdeationMode.AUTONOMOUS_AI: return <ArrowTrendingUpIcon />;
        default: return <LightBulbIcon />;
    }
  };


  return (
    <ModuleWrapper 
        title="Ideation Hub" 
        icon={<LightBulbIcon />} 
        subtitle="Craft, co-create, or discover research ideas with powerful AI assistance."
    >
      {notification && <NotificationBanner type={notification.type} message={notification.message} onDismiss={() => setNotification(null)} />}
      {projectError && <NotificationBanner type="error" message={projectError} onDismiss={clearError} />}
      
      {!currentProject && isHCP && (
        <Card title="Start a New Research Project" icon={<SparklesIcon />} className="mb-6 border-primary-200 bg-primary-50">
          <div className="space-y-4">
            <TextInput 
              label="Project Title" 
              placeholder="Enter a descriptive title for your research project"
              value={projectTitle} 
              onChange={(e) => setProjectTitle(e.target.value)} 
            />
            <p className="text-sm text-gray-600">First, choose an ideation mode below, then start your project.</p>
          </div>
        </Card>
      )}
       {!isHCP && !currentProject && (
         <Card className="mb-6 text-center">
            <p className="text-gray-600">Only Healthcare Professionals (HCPs) can initiate new projects. Other roles can view active projects once assigned.</p>
        </Card>
      )}

      <Card 
        title="Choose Your Ideation Approach" 
        icon={<SparklesIcon />} 
        className="mb-6 bg-gradient-to-r from-gray-50 to-slate-50 shadow-md"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {IDEATION_MODE_CONFIG.map(modeConfig => (
            <SelectionCard
              key={modeConfig.mode}
              title={modeConfig.title}
              description={modeConfig.description}
              icon={
                modeConfig.mode === IdeationMode.CLINICIAN_LED ? <LightBulbIcon /> :
                modeConfig.mode === IdeationMode.AI_CO_CREATION ? <ChatBubbleLeftEllipsisIcon /> :
                modeConfig.mode === IdeationMode.AUTONOMOUS_AI ? <ArrowTrendingUpIcon /> : <LightBulbIcon/>
              }
              onSelect={() => handleModeSelect(modeConfig.mode)}
              isSelected={selectedIdeationMode === modeConfig.mode}
              tooltipText={modeConfig.tooltip}
            />
          ))}
        </div>
      </Card>
      
      {selectedIdeationMode && (
        <>
          {!currentProject && isHCP && ( 
            <Card className="mb-6">
                 <TextInput 
                    label="Project Title (Required to Start)" 
                    placeholder="Enter project title"
                    value={projectTitle} 
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="mb-3"
                />
                <Button 
                    onClick={handleStartNewProject} 
                    disabled={projectLoading || !projectTitle.trim() || !selectedIdeationMode}
                    className="w-full"
                >
                    Start Project in "{IDEATION_MODE_CONFIG.find(m=>m.mode === selectedIdeationMode)?.title || 'Selected Mode'}"
                </Button>
            </Card>
          )}

          {currentProject && (
            <>
            <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-700">Project: {currentProject.title}</h3>
                <p className="text-sm text-gray-500">Mode: <span className="font-medium">{IDEATION_MODE_CONFIG.find(m=>m.mode === (currentProject.idea?.ideationMode || selectedIdeationMode))?.title || selectedIdeationMode}</span></p>
            </div>

            {selectedIdeationMode === IdeationMode.CLINICIAN_LED && (
                <Card title={`Define Your Research Idea (${IDEATION_MODE_CONFIG.find(m => m.mode === IdeationMode.CLINICIAN_LED)?.title})`} icon={<LightBulbIcon />}>
                    <div className="space-y-4">
                        <TextAreaInput label="Core Research Concept / Question" value={ideaInput.concept || ''} onChange={e => handleInputChange('concept', e.target.value)} rows={3} placeholder="Briefly describe your main research idea or question." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextAreaInput label="Background (Optional)" value={ideaInput.background || ''} onChange={e => handleInputChange('background', e.target.value)} placeholder="What is already known? What is the context?" />
                        <TextAreaInput label="Research Objective / Hypothesis (Optional)" value={ideaInput.objective || ''} onChange={e => handleInputChange('objective', e.target.value)} placeholder="What specific question will you answer or hypothesis will you test?" />
                        <TextAreaInput label="Brief Methodology Idea (Optional)" value={ideaInput.methodology || ''} onChange={e => handleInputChange('methodology', e.target.value)} placeholder="How might you conduct this research? (e.g., retrospective chart review, survey)" />
                        <TextAreaInput label="Significance / Potential Impact (Optional)" value={ideaInput.significance || ''} onChange={e => handleInputChange('significance', e.target.value)} placeholder="Why is this research important? Who will benefit?" />
                        </div>
                        <TextAreaInput label="Expected Outcomes (Optional)" value={ideaInput.expectedOutcomes || ''} onChange={e => handleInputChange('expectedOutcomes', e.target.value)} placeholder="What do you anticipate finding?" />

                        <div className="mt-6 pt-4 border-t border-gray-200 space-y-5">
                            <h4 className="text-md font-semibold text-gray-700">Refine Literature Search (Optional)</h4>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Databases</label>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {databaseOptions.map(db => (
                                    <div key={db} className="flex items-center">
                                    <input id={`db-${db}`} type="checkbox" checked={selectedDatabases.includes(db)} onChange={() => handleCheckboxChange(setSelectedDatabases, db)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                                    <label htmlFor={`db-${db}`} className="ml-2 text-sm text-gray-600">{db}</label>
                                    </div>
                                ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Prioritize Literature Types</label>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {literatureTypeOptions.map(type => (
                                    <div key={type} className="flex items-center">
                                    <input id={`type-${type}`} type="checkbox" checked={selectedLiteratureTypes.includes(type)} onChange={() => handleCheckboxChange(setSelectedLiteratureTypes, type)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                                    <label htmlFor={`type-${type}`} className="ml-2 text-sm text-gray-600">{type}</label>
                                    </div>
                                ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <TextInput label="Year From (Optional)" placeholder="YYYY" value={yearRange.from} onChange={e => setYearRange(prev => ({ ...prev, from: e.target.value.replace(/[^0-9]/g, '') }))} type="text" maxLength={4} />
                                <TextInput label="Year To (Optional)" placeholder="YYYY" value={yearRange.to} onChange={e => setYearRange(prev => ({ ...prev, to: e.target.value.replace(/[^0-9]/g, '') }))} type="text" maxLength={4} />
                            </div>
                        </div>

                        <Button onClick={validateIdeaAndGenerateReport} isLoading={projectLoading || isSearchingSources} disabled={!ideaInput.concept?.trim() || !isHCP || projectLoading || isSearchingSources} leftIcon={<SparklesIcon className="h-5 w-5" />}>
                        Generate AI Analysis & Report
                        </Button>
                        {!isHCP && <p className="text-sm text-red-500">Only HCPs can submit ideas for analysis.</p>}
                    </div>
                </Card>
            )}

            {selectedIdeationMode === IdeationMode.AI_CO_CREATION && (
                <Card title={`AI Co-Pilot for Idea Discovery (${IDEATION_MODE_CONFIG.find(m => m.mode === IdeationMode.AI_CO_CREATION)?.title})`} icon={<ChatBubbleLeftEllipsisIcon />}>
                    <div className="space-y-4 mb-6 p-4 border rounded-md bg-blue-50">
                        <h5 className="font-semibold text-gray-700">Your Profile (for personalized AI suggestions):</h5>
                        <TextInput label="Your Experience Level (e.g., Junior Resident, Senior Consultant)" value={hcpProfile.experience} onChange={e => handleHcpProfileChange('experience', e.target.value)} />
                        <TextInput label="Your Specialty (e.g., Cardiology, Pediatrics)" value={hcpProfile.specialty} onChange={e => handleHcpProfileChange('specialty', e.target.value)} />
                        <TextAreaInput label="Your Research Interests (Keywords or phrases)" value={hcpProfile.interests} onChange={e => handleHcpProfileChange('interests', e.target.value)} rows={2} />
                        <Button onClick={handleAiCoCreation} isLoading={projectLoading} disabled={!hcpProfile.specialty.trim() || !hcpProfile.interests.trim() || !isHCP} leftIcon={<SparklesIcon className="h-5 w-5" />}>
                            Start AI Co-Creation Chat
                        </Button>
                        {!isHCP && <p className="text-sm text-red-500">Only HCPs can use AI Co-Creation.</p>}
                    </div>
                    <ChatInterface 
                        systemInstruction={`You are an AI research partner. The HCP's profile is: Specialty - ${hcpProfile.specialty || 'Not specified'}, Interests - ${hcpProfile.interests || 'Not specified'}. Engage in an interactive dialogue to co-create a novel research idea. Help refine thoughts into a concrete research question. Start by suggesting 2-3 broad areas based on their profile.`}
                        placeholder="Chat with AI to develop your research idea..."
                        onNewAIMessage={(aiMsg) => {
                            if (currentProject) updateIdea({ concept: `Co-created (${IDEATION_MODE_CONFIG.find(m => m.mode === IdeationMode.AI_CO_CREATION)?.title}): ${aiMsg.text.substring(0,100)}...`});
                        }}
                    />
                </Card>
            )}
            
            {selectedIdeationMode === IdeationMode.AUTONOMOUS_AI && (
                <Card title={`Autonomous AI-Driven Discovery (${IDEATION_MODE_CONFIG.find(m => m.mode === IdeationMode.AUTONOMOUS_AI)?.title})`} icon={<ArrowTrendingUpIcon />}>
                    <p className="text-sm text-gray-600 mb-4">
                        Review novel research questions/hypotheses generated autonomously by AI. Select one to explore further and generate an AI Analysis Report.
                    </p>
                    <Button onClick={handleLoadAutonomousIdeas} isLoading={projectLoading} leftIcon={<SparklesIcon className="h-5 w-5" />} className="mb-4">
                        Load AI-Generated Idea Suggestions
                    </Button>
                    {autonomousIdeas.length > 0 && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {autonomousIdeas.map(idea => (
                                <div 
                                    key={idea.id} 
                                    className={`p-3 border rounded-md cursor-pointer transition-all hover:shadow-md ${selectedAutonomousIdea === idea.id ? 'bg-primary-100 border-primary-400 ring-2 ring-primary-300' : 'bg-gray-50 border-gray-200'}`}
                                    onClick={() => handleSelectAutonomousIdea(idea)}
                                >
                                    <h5 className="font-semibold text-primary-700">{idea.question}</h5>
                                    <p className="text-xs text-gray-600 mt-1">{idea.rationale}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {selectedAutonomousIdea && ideaInput.concept && (
                        <div className="mt-4 p-4 border border-green-200 rounded-md bg-green-50">
                            <h5 className="font-semibold text-green-700">Selected for Analysis:</h5>
                            <p className="text-gray-800 mt-1"><strong>Question:</strong> {ideaInput.concept}</p>
                            <p className="text-gray-700 mt-1"><strong>Rationale:</strong> {ideaInput.background}</p>
                             <Button onClick={validateIdeaAndGenerateReport} isLoading={projectLoading || isSearchingSources} size="sm" className="mt-3" disabled={!isHCP || projectLoading || isSearchingSources}>Analyze this AI Idea</Button>
                             {!isHCP && <p className="text-sm text-red-500 mt-1">Only HCPs can submit ideas for analysis.</p>}
                        </div>
                    )}
                </Card>
            )}

            {isSearchingSources && (
                <Card className="mt-6 text-center border-blue-200 bg-blue-50">
                    <LoadingSpinner message={`searching ${selectedDatabases.join(', ')}...`} />
                </Card>
            )}
            
            {projectLoading && !isSearchingSources && (
                <Card className="mt-6 text-center">
                    <LoadingSpinner message="AI is analyzing your idea and generating a report..." />
                </Card>
            )}
            
            {currentProject.idea?.aiReport && !projectLoading && !isSearchingSources && (
            <Card title="AI Analysis Report" icon={<SparklesIcon />} className="mt-6 border-blue-200 bg-blue-50">
              <div className="space-y-4">
                <Gauge value={currentProject.idea.noveltyScore || 0} label="Novelty Score" />
                
                <div><strong className="text-gray-700">Literature Summary:</strong> <p className="text-gray-600 text-sm whitespace-pre-wrap mt-1 p-2 bg-white rounded border border-gray-200 max-h-40 overflow-y-auto">{currentProject.idea.aiReport.literatureSummary}</p></div>
                <div><strong className="text-gray-700">Identified Research Gaps:</strong> <p className="text-gray-600 text-sm whitespace-pre-wrap mt-1 p-2 bg-white rounded border border-gray-200 max-h-40 overflow-y-auto">{currentProject.idea.aiReport.researchGaps}</p></div>
                <div><strong className="text-gray-700">Initial Feasibility Assessment:</strong> <p className="text-gray-600 text-sm whitespace-pre-wrap mt-1 p-2 bg-white rounded border border-gray-200 max-h-40 overflow-y-auto">{currentProject.idea.aiReport.feasibilityAssessment}</p></div>
                {currentProject.idea.aiReport.aiSuggestions && (
                     <div><strong className="text-gray-700">AI Suggestions for Refinement:</strong> <p className="text-gray-600 text-sm whitespace-pre-wrap mt-1 p-2 bg-white rounded border border-gray-200 max-h-40 overflow-y-auto">{currentProject.idea.aiReport.aiSuggestions}</p></div>
                )}
                 <p className="text-xs text-gray-500">Novelty Rating (Qualitative): <span className="font-semibold">{currentProject.idea.aiReport.noveltyRating}</span></p>
              </div>
              {currentProject.idea?.expertAssigned && currentProject.assignedResearcher && (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-md flex items-center">
                    <BellIcon className="h-6 w-6 text-indigo-500 mr-3"/>
                    <p className="text-sm text-indigo-700">
                        An Experienced Researcher (<strong>{MOCK_USERS.find(u=>u.id === currentProject.assignedResearcher)?.name || 'Expert'}</strong>) has been notionally assigned.
                    </p>
                </div>
              )}
            </Card>
          )}
           {isHCP && (
                <Button 
                    onClick={proceedToProposal} 
                    disabled={projectLoading || isSearchingSources || (!currentProject.idea?.aiReport && selectedIdeationMode !== IdeationMode.AI_CO_CREATION && !(selectedIdeationMode === IdeationMode.AUTONOMOUS_AI && currentProject.idea?.concept) )} 
                    className="mt-6 w-full" 
                    size="lg"
                >
                    Proceed to Proposal Development
                </Button>
            )}
            </>
          )}
        </>
      )}
    </ModuleWrapper>
  );
};
