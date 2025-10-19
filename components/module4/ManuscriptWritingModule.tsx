
import React, { useState, useEffect, useCallback } from 'react';
import { ModuleWrapper } from '../core/ModuleWrapper';
import { BookOpenIcon, SparklesIcon, PaperAirplaneIcon, BellIcon, ChevronDownIcon, ArrowLeftIcon, CheckBadgeIcon } from '../../assets/icons';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { TextAreaInput } from '../shared/TextAreaInput';
import { TextInput } from '../shared/TextInput';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useProject } from '../../contexts/ProjectContext';
import { Manuscript, UserRole, ModuleStage, JournalSuggestion, ArticleType, ArticleRequirements, ManuscriptSectionInfo } from '../../types';
import { generateText, generateJsonOutput } from '../../services/geminiService';
import { MOCK_USERS } from '../../constants';
import { NotificationBanner } from '../shared/NotificationBanner';
import { useAuth } from '../../contexts/AuthContext';
import { RichTextEditor } from '../shared/RichTextEditor';


const DEFAULT_MANUSCRIPT_SECTIONS: ManuscriptSectionInfo[] = [
    { id: "abstract", name: "Abstract", placeholder: "Structured abstract (Background, Methods, Results, Conclusion)." },
    { id: "introduction", name: "Introduction", placeholder: "Background, rationale, objectives of the study." },
    { id: "methods", name: "Methods", placeholder: "Detailed description of study design, participants, interventions, outcomes, statistical analysis." },
    { id: "results", name: "Results", placeholder: "Presentation of findings, referring to tables and figures." },
    { id: "discussion", name: "Discussion", placeholder: "Interpretation of results, comparison with other studies, limitations, implications." },
    { id: "conclusions", name: "Conclusions", placeholder: "Summary of key findings and their significance." },
    { id: "references", name: "References", placeholder: "List of cited works. Use AI to help format." },
];

const StartProjectPrompt: React.FC<{moduleName: string}> = ({moduleName}) => {
    const { startNewProject, error, setError, clearError } = useProject();
    const [projectTitle, setProjectTitle] = useState('');

    const handleStart = () => {
        clearError();
        if (!projectTitle.trim()) {
            setError("Project title is required.");
            return;
        }
        startNewProject(projectTitle);
    };

    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Start a New Project to use this Module</h3>
            <p className="text-gray-600 mb-4">
                To begin working on {moduleName}, you need an active project. Please provide a title to start. You can also start or select a different project in the 'IDEA Hub'.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <TextInput 
                    label="Project Title"
                    id="projectTitle"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="e.g., Manuscript for Diabetes Study"
                    className="w-full sm:flex-grow"
                />
                <Button onClick={handleStart} className="w-full sm:w-auto mt-4 sm:mt-6">Start Project</Button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </Card>
    );
};

type PublicationStep = 'journalSelection' | 'articleTypeSelection' | 'manuscriptEditing';

export const ManuscriptWritingModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    currentProject, 
    updateManuscript,
    isLoading, 
    setIsLoading, 
    error, 
    setError,
    clearError
  } = useProject();
  
  const [step, setStep] = useState<PublicationStep>('journalSelection');
  const [manuscript, setManuscript] = useState<Partial<Manuscript>>({ sections: {}, status: "Drafting" });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  
  const [journalSuggestions, setJournalSuggestions] = useState<JournalSuggestion[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<JournalSuggestion | null>(null);
  
  const [articleTypes, setArticleTypes] = useState<ArticleType[]>([]);
  const [selectedArticleType, setSelectedArticleType] = useState<ArticleType | null>(null);
  const [articleRequirements, setArticleRequirements] = useState<ArticleRequirements | null>(null);
  const [dynamicSections, setDynamicSections] = useState<ManuscriptSectionInfo[]>(DEFAULT_MANUSCRIPT_SECTIONS);
  
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [showMeetingPlaceholder, setShowMeetingPlaceholder] = useState(false);
  
  const [showFilters, setShowFilters] = useState(false);
  const [impactFactorRange, setImpactFactorRange] = useState({ min: '', max: '' });
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedQuartiles, setSelectedQuartiles] = useState<string[]>([]);
  const [openAccessType, setOpenAccessType] = useState('Any');

  useEffect(() => {
    // Populate manuscript from project
    if (currentProject?.manuscript) {
      setManuscript(currentProject.manuscript);
    } else if (currentProject) {
      setManuscript({
        title: currentProject.title ? `Manuscript: ${currentProject.title}` : "Research Manuscript",
        sections: {
          introduction: currentProject.proposal?.sections?.background || '',
          methods: `${currentProject.proposal?.sections?.methodology || ''}\n\nAnalysis Plan:\n${currentProject.analysis?.plan || ''}`,
          results: currentProject.analysis?.results || '', 
        },
        status: "Drafting",
      });
    } else {
      setManuscript({ sections: {}, status: "Drafting" });
    }

    // Reset flow or rehydrate state
    if (currentProject?.manuscript?.targetJournal && currentProject?.manuscript?.articleType && currentProject?.manuscript?.articleRequirements) {
        setSelectedJournal({ name: currentProject.manuscript.targetJournal, scope: '' }); // Simplified rehydration
        setSelectedArticleType({ name: currentProject.manuscript.articleType, description: ''});
        setArticleRequirements(currentProject.manuscript.articleRequirements);
        setDynamicSections(currentProject.manuscript.articleRequirements.requiredSections);
        setStep('manuscriptEditing');
        setActiveSection(currentProject.manuscript.articleRequirements.requiredSections[0]?.id || null);
    } else {
        setStep('journalSelection');
        setSelectedJournal(null);
        setArticleTypes([]);
        setSelectedArticleType(null);
        setArticleRequirements(null);
        setDynamicSections(DEFAULT_MANUSCRIPT_SECTIONS);
        setActiveSection(null);
    }

    if (currentProject?.assignedResearcher && currentProject.analysis?.isValidated && !currentProject.manuscript) {
        setShowMeetingPlaceholder(true);
    }
  }, [currentProject]);

  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  const handleSectionChange = (sectionId: string, value: string) => {
    setManuscript(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: value,
      },
    }));
  };

  const handleSaveManuscript = () => {
    if (!currentProject) return;
    updateManuscript({ 
        ...manuscript, 
        targetJournal: selectedJournal?.name,
        articleType: selectedArticleType?.name,
        articleRequirements: articleRequirements || undefined
    });
    setNotification({ message: "Manuscript draft saved!", type: 'success' });
  };

  const suggestJournals = async () => {
    if (!currentProject) {
        setError("Need an active project to suggest journals.");
        return;
    }
    setIsLoading(true);
    clearError();
    setNotification(null);

    const systemInstruction = "You are an AI research assistant for publication strategy. Based on the abstract/summary and filters, suggest 3-5 suitable journals. Provide name, scope, impact factor (simulated), country, journal quartile (e.g., Q1, Q2), and open access policy (e.g., 'Fully Open Access', 'Hybrid'). Provide a rationale for each suggestion. Output as JSON: [{name, scope, impactFactor, country, quartile, openAccess, rationale}, ...]";
    const studyAbstract = manuscript.sections?.abstract || manuscript.sections?.introduction || currentProject.idea?.concept || "Abstract not yet available. The study is about " + currentProject.title;
    const filterCriteria = `FILTER CRITERIA (adhere to these strictly): Min Impact Factor: ${impactFactorRange.min || 'any'}, Max Impact Factor: ${impactFactorRange.max || 'any'}, Country/Region: ${selectedCountries.join(', ') || 'any'}, Journal Quartile: ${selectedQuartiles.join(', ') || 'any'}, Open Access: ${openAccessType !== 'Any' ? openAccessType : 'any'}`;
    const prompt = `Study Abstract/Summary: --- ${studyAbstract} --- ${filterCriteria}. Suggest journals that match the abstract and ALL specified filters.`;

    const response = await generateJsonOutput<JournalSuggestion[]>(prompt, systemInstruction);
    if (response.data) {
        setJournalSuggestions(response.data);
        setNotification({ message: "AI suggested potential journals based on your criteria.", type: 'success' });
    } else {
        setError(response.error || "Failed to get journal suggestions. Raw: " + response.rawText);
        setNotification({ message: `Error: ${response.error}`, type: 'error' });
    }
    setIsLoading(false);
  };
  
  const fetchArticleTypes = useCallback(async (journalName: string) => {
    setIsLoading(true);
    clearError();
    setNotification({ message: `Fetching article types for ${journalName}...`, type: 'info' });

    const systemInstruction = `For the journal '${journalName}', list the common article types they publish (e.g., Original Article, Research Letter, Case Report, Review, Editorial). Provide a brief description for each. Output as a JSON array using this exact structure: [{ "name": "string", "description": "string" }].`;
    const prompt = `List article types for ${journalName}.`;

    const response = await generateJsonOutput<ArticleType[]>(prompt, systemInstruction);
    if (response.data) {
        setArticleTypes(response.data);
    } else {
        setError(response.error || "Failed to fetch article types.");
        setStep('journalSelection'); // Go back if it fails
    }
    setIsLoading(false);
  }, [setError]);

  const fetchArticleRequirements = useCallback(async (journalName: string, articleTypeName: string) => {
    setIsLoading(true);
    clearError();
    setNotification({ message: `Fetching guidelines for ${articleTypeName}...`, type: 'info' });

    const systemInstruction = `For an '${articleTypeName}' in '${journalName}', provide specific author guidelines. Output as a JSON object with this exact structure: { "wordCount": number | null, "figureLimit": number | null, "referenceLimit": number | null, "referenceStyle": "string (e.g., Vancouver, APA)", "requiredSections": [{"id": "string_lowercase_no_spaces", "name": "string"}, ...], "checklist": ["string", ...] }. The checklist should summarize key constraints. For 'requiredSections', 'id' must be a lowercase slug version of the name. Use null if a value isn't applicable.`;
    const prompt = `Get guidelines for ${articleTypeName} in ${journalName}.`;

    const response = await generateJsonOutput<ArticleRequirements>(prompt, systemInstruction);
    if (response.data) {
        setArticleRequirements(response.data);
        setDynamicSections(response.data.requiredSections);
        setActiveSection(response.data.requiredSections[0]?.id || null);
        updateManuscript({
            ...manuscript,
            targetJournal: journalName,
            articleType: articleTypeName,
            articleRequirements: response.data,
        });
    } else {
        setError(response.error || "Failed to fetch article requirements.");
        setStep('articleTypeSelection'); // Go back if it fails
    }
    setIsLoading(false);
  }, [manuscript, updateManuscript, setError]);

  const handleJournalSelect = useCallback((journal: JournalSuggestion) => {
    setSelectedJournal(journal);
    setStep('articleTypeSelection');
    fetchArticleTypes(journal.name);
  }, [fetchArticleTypes]);
  
  const handleArticleTypeSelect = useCallback((articleType: ArticleType) => {
    if (!selectedJournal) return;
    setSelectedArticleType(articleType);
    setStep('manuscriptEditing');
    fetchArticleRequirements(selectedJournal.name, articleType.name);
  }, [selectedJournal, fetchArticleRequirements]);

  const markReadyForSubmission = () => {
    if(!currentProject) return;
    handleSaveManuscript(); // Save final state
    updateManuscript({ status: "Ready for Submission" });
    setNotification({ message: "Manuscript marked as 'Ready for Submission'.", type: 'success' });
  };
  
  const canEdit = currentUser?.role === UserRole.HCP || currentUser?.role === UserRole.RESEARCHER;

  if (!currentProject) {
    return (
      <ModuleWrapper title="Manuscript Writing & Publication" icon={<BookOpenIcon />}>
        <StartProjectPrompt moduleName="Manuscript Writing" />
      </ModuleWrapper>
    );
  }

  // Journal Selection View
  const renderJournalSelection = () => (
    <Card title="Publication Strategy">
      <div className="space-y-3">
        <Button onClick={suggestJournals} isLoading={isLoading} leftIcon={<SparklesIcon/>} className="w-full" variant="secondary">
          AI Suggest Journals/Venues
        </Button>
        <div className="pt-3 border-t border-gray-200">
          <button onClick={() => setShowFilters(!showFilters)} className="text-sm font-medium text-gray-700 hover:text-primary-700 w-full flex justify-between items-center py-1" aria-expanded={showFilters}>
            <span>Refine AI Suggestions</span>
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {showFilters && (
            <div className="mt-4 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <TextInput label="Min Impact Factor" type="number" placeholder="e.g., 5" value={impactFactorRange.min} onChange={e => setImpactFactorRange({...impactFactorRange, min: e.target.value})} />
                  <TextInput label="Max Impact Factor" type="number" placeholder="e.g., 20" value={impactFactorRange.max} onChange={e => setImpactFactorRange({...impactFactorRange, max: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Journal Quartile</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(q => ( <div key={q} className="flex items-center"> <input id={`q-${q}`} type="checkbox" checked={selectedQuartiles.includes(q)} onChange={() => handleCheckboxChange(setSelectedQuartiles, q)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /> <label htmlFor={`q-${q}`} className="ml-2 text-sm text-gray-600">{q}</label> </div> ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country / Region</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {['USA/Canada', 'Europe', 'Asia', 'Other'].map(c => ( <div key={c} className="flex items-center"> <input id={`c-${c}`} type="checkbox" checked={selectedCountries.includes(c)} onChange={() => handleCheckboxChange(setSelectedCountries, c)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /> <label htmlFor={`c-${c}`} className="ml-2 text-sm text-gray-600">{c}</label> </div> ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="open-access" className="block text-sm font-medium text-gray-700 mb-1">Open Access Policy</label>
                  <select id="open-access" value={openAccessType} onChange={e => setOpenAccessType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white text-gray-900">
                      <option>Any</option> <option>Fully Open Access</option> <option>Hybrid Available</option> <option>Subscription Only</option>
                  </select>
                </div>
            </div>
          )}
        </div>
        {isLoading && <LoadingSpinner message="Suggesting journals..." />}
        {journalSuggestions.length > 0 && (
          <div className="mt-3 space-y-2 max-h-96 overflow-y-auto p-1">
            {journalSuggestions.map((j, idx) => (
              <div key={idx} onClick={() => handleJournalSelect(j)} className="p-3 border rounded-md bg-gray-50 text-xs cursor-pointer transition-all hover:bg-primary-50 hover:border-primary-300 hover:shadow-md">
                <h5 className="font-semibold text-primary-700">{j.name}</h5>
                <div className="flex flex-wrap gap-x-3 text-gray-600 my-1">
                  <span>IF: <strong className="text-gray-800">{j.impactFactor || 'N/A'}</strong></span>
                  {j.quartile && <span>Quartile: <strong className="text-gray-800">{j.quartile}</strong></span>}
                  {j.country && <span>Country: <strong className="text-gray-800">{j.country}</strong></span>}
                </div>
                {j.openAccess && <p className="text-xs text-gray-600 mb-1">Open Access: <span className="font-medium text-gray-800">{j.openAccess}</span></p>}
                <p className="text-gray-600 mt-1 italic"><strong>Rationale:</strong> {j.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );

  // Article Type Selection View
  const renderArticleTypeSelection = () => (
    <Card title={`Select Article Type for: ${selectedJournal?.name}`}>
      <div className="mb-4">
        <Button onClick={() => setStep('journalSelection')} size="sm" variant="ghost" leftIcon={<ArrowLeftIcon className="h-4 w-4"/>}>
          Back to Journal Selection
        </Button>
      </div>
      {isLoading ? (
        <LoadingSpinner message="Fetching article types..." />
      ) : (
        <div className="space-y-2">
          {articleTypes.map(type => (
            <div key={type.name} onClick={() => handleArticleTypeSelect(type)} className="p-4 border rounded-lg cursor-pointer transition-all bg-white hover:bg-primary-50 hover:border-primary-300 hover:shadow-lg">
              <h4 className="font-semibold text-primary-800">{type.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{type.description}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  // Full Manuscript Editor View
  const renderManuscriptEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-6">
        <Card title="Publication Target">
            <div className="space-y-1">
                <p className="text-sm text-gray-500">Journal:</p>
                <h4 className="font-semibold text-primary-700">{selectedJournal?.name}</h4>
                <p className="text-sm text-gray-500 mt-2">Article Type:</p>
                <h4 className="font-semibold text-primary-700">{selectedArticleType?.name}</h4>
            </div>
            <Button onClick={() => setStep('articleTypeSelection')} size="sm" variant="ghost" className="mt-4 w-full">Change Article Type</Button>
        </Card>
        
        {articleRequirements && (
            <Card title="Guidelines Checklist" icon={<CheckBadgeIcon className="text-green-500" />}>
                <ul className="space-y-2 text-sm text-gray-700 max-h-60 overflow-y-auto">
                    {articleRequirements.checklist.map((item, index) => (
                        <li key={index} className="flex items-start">
                            <CheckBadgeIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"/>
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </Card>
        )}

        <Card title="Manuscript Sections">
          <nav className="space-y-1">
            {dynamicSections.map(section => (
              <button key={section.id} onClick={() => setActiveSection(section.id)} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === section.id ? 'bg-primary-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                {section.name}
              </button>
            ))}
          </nav>
          {canEdit && <Button onClick={handleSaveManuscript} isLoading={isLoading} className="w-full mt-6" variant="primary">Save Draft</Button>}
        </Card>
      </div>

      <div className="md:col-span-2">
        {activeSection && (
          <Card title={`Editing: ${dynamicSections.find(s => s.id === activeSection)?.name}`}>
             <RichTextEditor
                value={manuscript.sections?.[activeSection] || ''}
                onChange={value => handleSectionChange(activeSection, value)}
                placeholder={dynamicSections.find(s => s.id === activeSection)?.placeholder}
                disabled={!canEdit || isLoading}
              />
            {!canEdit && <p className="text-sm text-red-500 mt-2">You do not have permission to edit this manuscript.</p>}
          </Card>
        )}
        <Card title="Manuscript Status & Submission" icon={<PaperAirplaneIcon/>} className="mt-6">
            <p className="text-sm text-gray-700 mb-2">Current Status: 
                <span className={`ml-2 font-semibold px-2 py-0.5 rounded-full text-xs ${manuscript.status === "Ready for Submission" ? "bg-success-light text-success-textLight" : "bg-yellow-100 text-yellow-700"}`}>
                    {manuscript.status}
                </span>
            </p>
            {manuscript.status !== "Ready for Submission" && canEdit && <Button onClick={markReadyForSubmission} isLoading={isLoading} variant="primary">Mark as Ready for Submission</Button>}
            {manuscript.status === "Ready for Submission" && <p className="text-success-textLight font-medium">This draft is ready for final review and submission to '{selectedJournal?.name || 'the selected journal'}'.</p>}
        </Card>
      </div>
    </div>
  );

  return (
    <ModuleWrapper title="Manuscript Writing & Publication" icon={<BookOpenIcon />} subtitle={`For project: ${currentProject.title}`}>
      {notification && <NotificationBanner type={notification.type} message={notification.message} onDismiss={() => setNotification(null)} />}
      {error && <NotificationBanner type="error" message={error} onDismiss={clearError} />}

      {showMeetingPlaceholder && (
          <Card title="Manuscript Strategy Meeting" icon={<BellIcon />} className="mb-6 bg-info-light border-info-light">
              <p className="text-info-textLight">An Experienced Researcher (<strong>{MOCK_USERS.find(u => u.id === currentProject.assignedResearcher)?.name || 'Expert'}</strong>) is available. A (simulated) collaborative meeting should occur.</p>
              <Button onClick={() => setShowMeetingPlaceholder(false)} size="sm" variant="secondary" className="mt-3">Mark as Met (Simulated)</Button>
          </Card>
      )}

      {step === 'journalSelection' && renderJournalSelection()}
      {step === 'articleTypeSelection' && renderArticleTypeSelection()}
      {step === 'manuscriptEditing' && renderManuscriptEditor()}

    </ModuleWrapper>
  );
};
