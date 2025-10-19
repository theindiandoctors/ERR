
import React, { useState, useEffect, useCallback } from 'react';
import { ModuleWrapper } from '../core/ModuleWrapper';
import { DocumentTextIcon, SparklesIcon, CheckCircleIcon, BellIcon, BookOpenIcon, ArrowTrendingUpIcon, ClipboardDocumentListIcon, UserCircleIcon, ArrowLeftIcon, Cog6ToothIcon } from '../../assets/icons';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { TextAreaInput } from '../shared/TextAreaInput';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useProject } from '../../contexts/ProjectContext';
import { Proposal, UserRole, ModuleStage, ManuscriptSectionInfo } from '../../types';
import { generateTextWithRAG, generateJsonOutput } from '../../services/geminiService';
import { MOCK_KNOWLEDGE_BASES, MOCK_USERS } from '../../constants';
import { NotificationBanner } from '../shared/NotificationBanner';
import { InfoTooltip } from '../shared/InfoTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { TextInput } from '../shared/TextInput';
import { SelectionCard } from '../shared/SelectionCard';
import { RichTextEditor } from '../shared/RichTextEditor';

const PROPOSAL_SECTIONS_DEFAULT: ManuscriptSectionInfo[] = [
    { id: "background", name: "Detailed Background", placeholder: "Expand on the literature, identify gaps..." },
    { id: "objectives", name: "Research Objectives/Hypotheses", placeholder: "Clearly state primary and secondary objectives or testable hypotheses." },
    { id: "methodology", name: "Methodology", placeholder: "Study design, patient population, data collection methods, variables..." },
    { id: "sampleSize", name: "Sample Size Justification", placeholder: "How was the sample size determined? Power calculations?" },
    { id: "dataAnalysisPlan", name: "Data Analysis Plan", placeholder: "Statistical methods to be used for each objective." },
    { id: "budget", name: "Budget (Brief Outline)", placeholder: "Estimated costs for personnel, supplies, etc. (if applicable)." },
    { id: "ethics", name: "Ethical Considerations", placeholder: "Patient consent, data privacy, potential risks and mitigation." },
    { id: "dissemination", name: "Dissemination Plan", placeholder: "How will findings be shared? (e.g., publication, presentation)." },
];

const PROPOSAL_TYPES = [
  { id: 'observational', name: 'Observational Study', description: 'Observe subjects and measure variables without assigning treatments. Good for identifying associations.', icon: <ClipboardDocumentListIcon /> },
  { id: 'prospective', name: 'Prospective Cohort Study', description: 'Follow a group over time to see how factors affect outcomes. Powerful for causality.', icon: <ArrowTrendingUpIcon /> },
  { id: 'rct', name: 'Randomized Controlled Trial', description: 'Randomly assign subjects to treatment or control groups. The gold standard for intervention studies.', icon: <Cog6ToothIcon /> },
  { id: 'case_report', name: 'Case Report / Series', description: 'Detailed report on individual patients. Useful for rare conditions or novel treatments.', icon: <UserCircleIcon /> },
  { id: 'systematic_review', name: 'Systematic Review', description: 'Review existing literature to answer a specific question using systematic methods.', icon: <BookOpenIcon /> }
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
                    placeholder="e.g., Impact of Drug X on Condition Y"
                    className="w-full sm:flex-grow"
                />
                <Button onClick={handleStart} className="w-full sm:w-auto mt-4 sm:mt-6">Start Project</Button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </Card>
    );
};


export const ProposalDevelopmentModule: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { 
    currentProject, 
    updateProposal,
    isLoading, 
    setIsLoading, 
    error, 
    setError,
    assignExpert,
    setProjectStage,
    clearError
  } = useProject(); 
  
  type ProposalStep = 'typeSelection' | 'editing';
  const [step, setStep] = useState<ProposalStep>('typeSelection');

  const [proposal, setProposal] = useState<Partial<Proposal>>({ sections: {}, ethicsStatus: "Not Submitted" });
  const [dynamicSections, setDynamicSections] = useState<ManuscriptSectionInfo[]>(PROPOSAL_SECTIONS_DEFAULT);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [showMeetingPlaceholder, setShowMeetingPlaceholder] = useState(false);

  useEffect(() => {
    if (currentProject?.proposal) {
      setProposal(currentProject.proposal);
       if (currentProject.proposal.proposalType && currentProject.proposal.requiredSections) {
            setDynamicSections(currentProject.proposal.requiredSections);
            setStep('editing');
            setActiveSection(activeSection || currentProject.proposal.requiredSections[0]?.id || null);
       } else {
            setStep('typeSelection');
            setDynamicSections(PROPOSAL_SECTIONS_DEFAULT);
       }
    } else if (currentProject) {
      const initialProposal = {
        title: currentProject.title || "Research Proposal",
        sections: {
          background: currentProject.idea?.background || '',
          objectives: currentProject.idea?.objective || '',
          methodology: currentProject.idea?.methodology || '',
        },
        ethicsStatus: "Not Submitted" as const,
      };
      setProposal(initialProposal);
      setStep('typeSelection');
    } else {
      setProposal({ sections: {}, ethicsStatus: "Not Submitted" });
      setStep('typeSelection');
    }

    if (currentProject?.assignedResearcher && !currentProject.proposal) {
        setShowMeetingPlaceholder(true);
    }

  }, [currentProject]);

  const handleSectionChange = (sectionId: string, value: string) => {
    setProposal(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: value,
      },
    }));
  };

  const handleSaveProposal = () => {
    if (!currentProject) return;
    updateProposal(proposal);
    setNotification({ message: "Proposal draft saved successfully!", type: 'success' });
  };
  
  const handleProposalTypeSelect = async (type: { id: string; name: string }) => {
    if (!currentProject) {
        setError("Please start a project first.");
        return;
    }
    setIsLoading(true);
    clearError();
    setNotification({ message: `Configuring proposal for: ${type.name}...`, type: 'info' });

    const systemInstruction = `For a "${type.name}" research proposal, provide the standard sections. Output as a JSON array of objects, where each object has "id" (string, lowercase_snake_case), "name" (string, Title Case), and "placeholder" (string, a helpful prompt for the user).`;
    const prompt = `List the sections for a ${type.name} proposal.`;

    const response = await generateJsonOutput<ManuscriptSectionInfo[]>(prompt, systemInstruction);

    let newSections = PROPOSAL_SECTIONS_DEFAULT;
    if (response.data && response.data.length > 0) {
        newSections = response.data;
    } else {
        setError(response.error || "Failed to fetch proposal structure. Using default sections.");
    }
    
    setDynamicSections(newSections);

    const backgroundSectionId = newSections.find(s => s.id.includes('background'))?.id;
    const objectiveSectionId = newSections.find(s => s.id.includes('objective'))?.id;
    let initialSectionsContent: { [key: string]: string } = {};

    if (backgroundSectionId && currentProject?.idea?.background) {
        initialSectionsContent[backgroundSectionId] = currentProject.idea.background;
    }
    if (objectiveSectionId && currentProject?.idea?.objective) {
        initialSectionsContent[objectiveSectionId] = currentProject.idea.objective;
    }

    updateProposal({
        proposalType: type.name,
        requiredSections: newSections,
        sections: initialSectionsContent
    });

    setActiveSection(newSections[0].id);
    setStep('editing');
    setNotification({ message: `Proposal configured for ${type.name}.`, type: 'success' });
    setIsLoading(false);
  };


  const submitToEthics = () => {
    if (!currentProject) return;
    updateProposal({ ethicsStatus: "Submitted" });
    setNotification({ message: "Proposal submitted to Ethics Committee/IRB (Simulated).", type: 'success'});
  };

  const simulateEthicsFeedback = () => {
     if (!currentProject) return;
     const feedback = "The Ethics Committee has reviewed your proposal. Please clarify the patient recruitment strategy (Section: Methodology) and provide more details on data anonymization (Section: Ethics). Resubmission required.";
     updateProposal({ ethicsStatus: "Feedback Received", ethicsFeedback: feedback });
     setNotification({ message: "Simulated feedback received from Ethics Committee.", type: 'info' });
  };

  const markEthicsApproved = () => {
    if (!currentProject) return;
    updateProposal({ ethicsStatus: "Approved", ethicsFeedback: "Congratulations! Your proposal has been approved." });
    
    const statistician = MOCK_USERS.find(u => u.role === UserRole.STATISTICIAN);
    if (statistician) {
        assignExpert('statistician', statistician.id);
        setNotification({ message: `Proposal Approved! Statistician "${statistician.name}" has been assigned (12 hours allocated).`, type: 'success' });
    } else {
        setNotification({ message: "Proposal Approved! (No mock statistician found).", type: 'success' });
    }
  };

  const proceedToDataCollection = () => {
    if (currentProject?.proposal?.ethicsStatus === "Approved") {
        setProjectStage(ModuleStage.DATA_COLLECTION_ANALYSIS);
        setNotification({ message: "Proceeding to Data Collection & Analysis.", type: 'success' });
        navigate('/data');
    } else {
        setError("Proposal must be approved by Ethics Committee before proceeding.");
        setNotification({ message: "Proposal must be approved by Ethics Committee before proceeding.", type: 'error' });
    }
  };
  
  const canEdit = currentUser?.role === UserRole.HCP || currentUser?.role === UserRole.RESEARCHER;

  if (!currentProject) {
    return (
      <ModuleWrapper title="Proposal Development & Ethics" icon={<DocumentTextIcon />}>
        <StartProjectPrompt moduleName="Proposal Development" />
      </ModuleWrapper>
    );
  }
  
  const renderTypeSelection = () => (
    <Card title="Select Proposal Type" icon={<DocumentTextIcon />}>
        <p className="text-gray-600 mb-6">
            Choose the type of research proposal you intend to write. The platform will tailor the required sections and provide relevant guidance based on your selection.
        </p>
        {isLoading && <LoadingSpinner message="Configuring proposal..." />}
        {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PROPOSAL_TYPES.map(type => (
                    <SelectionCard
                        key={type.id}
                        title={type.name}
                        description={type.description}
                        icon={type.icon}
                        isSelected={false}
                        onSelect={() => handleProposalTypeSelect(type)}
                    />
                ))}
            </div>
        )}
    </Card>
  );

  const renderProposalEditor = () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card title="Proposal Sections">
            <Button onClick={() => setStep('typeSelection')} size="sm" variant="ghost" leftIcon={<ArrowLeftIcon className="h-4 w-4"/>} className="mb-3 w-full">
                Change Proposal Type
            </Button>
            <p className="text-xs text-gray-500 mb-2 px-1">Editing Type: <strong className="text-gray-700">{proposal.proposalType}</strong></p>
            <nav className="space-y-1">
              {dynamicSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${activeSection === section.id 
                      ? 'bg-primary-500 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {section.name}
                </button>
              ))}
            </nav>
            {canEdit && (
                <Button onClick={handleSaveProposal} isLoading={isLoading} className="w-full mt-6" variant="primary">
                    Save Draft Proposal
                </Button>
            )}
          </Card>
           <Card title="Ethics Committee / IRB Workflow" icon={<CheckCircleIcon />}>
                <div className="space-y-4">
                <div>
                    <p className="text-sm font-medium text-gray-700">Current Status: 
                    <span className={`ml-2 font-semibold px-2 py-0.5 rounded-full text-xs
                        ${proposal.ethicsStatus === "Approved" ? "bg-success-light text-success-textLight" :
                        proposal.ethicsStatus === "Submitted" ? "bg-yellow-100 text-yellow-700" : 
                        proposal.ethicsStatus === "Feedback Received" ? "bg-orange-100 text-orange-700" : 
                        "bg-gray-100 text-gray-700"}`}>
                        {proposal.ethicsStatus}
                    </span>
                    </p>
                    {proposal.ethicsFeedback && (
                    <div className="mt-2 p-3 bg-gray-50 border rounded-md text-sm text-gray-600">
                        <strong>Feedback/Notes:</strong> {proposal.ethicsFeedback}
                    </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {canEdit && proposal.ethicsStatus === "Not Submitted" && (
                    <Button onClick={submitToEthics} isLoading={isLoading} variant="primary">Submit to Ethics (Simulated)</Button>
                    )}
                    {proposal.ethicsStatus === "Submitted" && (
                    <Button onClick={simulateEthicsFeedback} isLoading={isLoading} variant="secondary">Simulate Ethics Feedback</Button>
                    )}
                    {canEdit && proposal.ethicsStatus === "Feedback Received" && (
                    <>
                        <p className="text-sm text-gray-600 w-full">Address feedback in proposal sections, then resubmit or mark as approved.</p>
                        <TextAreaInput 
                            label="Draft Response to Ethics Committee (Optional)"
                            placeholder="Draft your response here. AI can help refine it."
                            rows={3}
                        />
                        <Button onClick={submitToEthics} isLoading={isLoading} variant="primary">Resubmit to Ethics (Simulated)</Button>
                    </>
                    )}
                     {canEdit && proposal.ethicsStatus !== "Approved" && (
                         <Button onClick={markEthicsApproved} isLoading={isLoading} variant="ghost" size="sm">Force Mark Approved (Dev)</Button>
                     )}
                </div>
                
                {currentProject.proposal?.statisticianAssigned && currentProject.assignedStatistician && (
                    <div className="mt-4 p-3 bg-info-light border border-info-light rounded-md flex items-center">
                        <BellIcon className="h-6 w-6 text-info mr-3"/>
                        <p className="text-sm text-info-textLight">
                            A Statistician (<strong>{MOCK_USERS.find(u=>u.id === currentProject.assignedStatistician)?.name || 'Expert'}</strong>) has been notionally assigned.
                        </p>
                    </div>
                )}

                {proposal.ethicsStatus === "Approved" && (
                    <Button onClick={proceedToDataCollection} isLoading={isLoading} className="mt-4" variant="primary">
                    Proceed to Data Collection & Analysis
                    </Button>
                )}
                </div>
            </Card>
        </div>

        <div className="md:col-span-2">
          {activeSection && dynamicSections.find(s => s.id === activeSection) && (
            <Card title={`Editing: ${dynamicSections.find(s => s.id === activeSection)?.name}`}>
              <RichTextEditor
                value={proposal.sections?.[activeSection] || ''}
                onChange={value => handleSectionChange(activeSection, value)}
                placeholder={dynamicSections.find(s => s.id === activeSection)?.placeholder}
                disabled={!canEdit || isLoading}
              />
              {!canEdit && <p className="text-sm text-red-500 mt-2">You do not have permission to edit this proposal.</p>}
            </Card>
          )}
        </div>
      </div>
  );


  return (
    <ModuleWrapper title="Proposal Development & Ethics" icon={<DocumentTextIcon />} subtitle={`For project: ${currentProject.title}`}>
      {notification && <NotificationBanner type={notification.type} message={notification.message} onDismiss={() => setNotification(null)} />}
      {error && <NotificationBanner type="error" message={error} onDismiss={clearError} />}

      {showMeetingPlaceholder && (
          <Card title="Initial Consultation" icon={<BellIcon />} className="mb-6 bg-info-light border-info-light">
              <p className="text-info-textLight">
                  An Experienced Researcher (<strong>{MOCK_USERS.find(u => u.id === currentProject.assignedResearcher)?.name || 'Expert'}</strong>) is assigned.
                  A (simulated) 1-hour collaborative meeting should be scheduled.
              </p>
              <Button onClick={() => setShowMeetingPlaceholder(false)} size="sm" variant="secondary" className="mt-3">Mark as Met (Simulated)</Button>
          </Card>
      )}

      {step === 'typeSelection' ? renderTypeSelection() : renderProposalEditor()}
    </ModuleWrapper>
  );
};
