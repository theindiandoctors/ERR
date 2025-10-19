
import React, { useState, useEffect, useCallback } from 'react';
import { ModuleWrapper } from '../core/ModuleWrapper';
import { TableCellsIcon, SparklesIcon, CheckCircleIcon, BellIcon, BeakerIcon, SquaresPlusIcon, ChartBarIcon, LineChartIcon, ScatterPlotIcon, BoxPlotIcon, XCircleIcon } from '../../assets/icons';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useProject } from '../../contexts/ProjectContext';
import { DataSet, StatisticalAnalysis, UserRole, ModuleStage } from '../../types';
import { generateText, generateJsonOutput } from '../../services/geminiService';
import { NotificationBanner } from '../shared/NotificationBanner';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_USERS } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, Scatter, LineChart, ScatterChart } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { TextInput } from '../shared/TextInput';
import { InfoTooltip } from '../shared/InfoTooltip';

const MOCK_DATA_SAMPLE = [
  { name: 'Group A', value: 400, pv: 2400, amt: 2400, hba1c: 6.5 },
  { name: 'Group B', value: 300, pv: 1398, amt: 2210, hba1c: 7.1 },
  { name: 'Group C', value: 200, pv: 9800, amt: 2290, hba1c: 8.2 },
  { name: 'Group D', value: 278, pv: 3908, amt: 2000, hba1c: 6.9 },
  { name: 'Group E', value: 189, pv: 4800, amt: 2181, hba1c: 7.5 },
];

const DESCRIPTIVE_STATS = [
  { id: 'central_tendency', name: 'Central Tendency (Mean, Median, Mode)' },
  { id: 'dispersion', name: 'Dispersion (Standard Deviation, Variance, Range)' },
  { id: 'frequency', name: 'Frequency Counts & Percentages (for categorical data)' },
];

const INFERENTIAL_TESTS = [
  { id: 'ttest', name: 'Independent T-Test', description: 'Compare means of two independent groups.' },
  { id: "anova", name: "ANOVA", description: "Compare means of three or more groups." },
  { id: 'chi2', name: 'Chi-Square Test', description: 'Test association between two categorical variables.' },
  { id: 'linreg', name: 'Linear Regression', description: 'Model the relationship between variables.' },
  { id: 'logreg', name: 'Logistic Regression', description: 'Model the probability of a binary outcome.' },
];

const GRAPH_TYPES = ['Bar', 'Line', 'Scatter', 'Histogram', 'BoxPlot'];

type GraphType = 'Bar' | 'Line' | 'Scatter' | 'Histogram' | 'BoxPlot';
interface GraphConfig {
  id: string;
  type: GraphType;
  variables: {
    x: string;
    y: string;
    group?: string;
  };
}


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
                    placeholder="e.g., Analysis of Patient Outcomes"
                    className="w-full sm:flex-grow"
                />
                <Button onClick={handleStart} className="w-full sm:w-auto mt-4 sm:mt-6">Start Project</Button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </Card>
    );
};

export const DataAnalysisModule: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { 
    currentProject, 
    updateDataSet,
    updateAnalysis,
    isLoading, 
    setIsLoading, 
    error, 
    setError,
    setProjectStage,
    clearError
  } = useProject();

  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [dataPreview, setDataPreview] = useState<Record<string, any>[] | null>(null);
  const [showMeetingPlaceholder, setShowMeetingPlaceholder] = useState(false);
  
  const [selectedDescriptives, setSelectedDescriptives] = useState<string[]>([]);
  const [selectedInferentials, setSelectedInferentials] = useState<string[]>([]);
  const [graphConfigs, setGraphConfigs] = useState<GraphConfig[]>([]);

  const [statisticalResults, setStatisticalResults] = useState<Partial<StatisticalAnalysis>>({});
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (currentProject?.dataSet) {
      setGeneratedSQL(currentProject.dataSet.sourceQuery || '');
      setDataPreview(currentProject.dataSet.simulatedData || null);
    }
    if (currentProject?.analysis) {
        setSelectedDescriptives(currentProject.analysis.measuresToReport || []);
        setSelectedInferentials(currentProject.analysis.testTypes || []);
        // NOTE: Graph configs are not persisted in this simplified version.
        setStatisticalResults(currentProject.analysis);
    } else if (currentProject) {
        setStatisticalResults({});
        setSelectedDescriptives([]);
        setSelectedInferentials([]);
        setGraphConfigs([]);
    }
    
    if (currentProject?.assignedStatistician && !currentProject.analysis) {
        setShowMeetingPlaceholder(true);
    }
  }, [currentProject]);

  const handleQueryGeneration = async () => {
    if (!currentProject || !naturalLanguageQuery.trim()) {
      setError("Please provide a natural language query for data extraction.");
      return;
    }
    setIsLoading(true);
    clearError();
    setNotification(null);

    const systemInstruction = "You are an AI data assistant. Translate the user's natural language request into an SQL query. Assume a generic relational database schema. Output only the SQL query.";
    const prompt = `Natural Language Request: "${naturalLanguageQuery}" \nTranslate this into an SQL query.`;
    
    const response = await generateText(prompt, systemInstruction);

    if (response.text && !response.error) {
      const extractedSQL = response.text.replace(/```sql\n?|\n?```/g, '').trim();
      setGeneratedSQL(extractedSQL);
      updateDataSet({ name: "Extracted Dataset", description: `Data from query: ${naturalLanguageQuery}`, sourceQuery: extractedSQL });
      setNotification({ message: "SQL query generated. Review before 'execution'.", type: 'info' });
    } else {
      setError(response.error || "Failed to generate SQL query.");
      setNotification({ message: `Error: ${response.error}`, type: 'error' });
    }
    setIsLoading(false);
  };

  const simulateDataExtraction = () => {
    if (!generatedSQL) {
        setError("No SQL query to execute.");
        return;
    }
    setIsLoading(true);
    setTimeout(() => {
        const simulatedData = MOCK_DATA_SAMPLE.map(item => ({
            ...item,
            id: Math.random().toString(36).substring(7),
            diagnosis_code: `ICD10-${Math.floor(Math.random() * 100)}`,
        }));
        setDataPreview(simulatedData);
        updateDataSet({ simulatedData: simulatedData });
        setNotification({ message: "Data extraction simulated successfully. Preview below.", type: 'success' });
        setIsLoading(false);
    }, 1500);
  };

  const handleStatisticalAnalysis = async () => {
    if (!currentProject || (selectedDescriptives.length === 0 && selectedInferentials.length === 0) || !dataPreview) {
      setError("Please define an analysis plan by selecting tests and ensure data is 'extracted' or uploaded.");
      return;
    }
    setIsLoading(true);
    clearError();
    setNotification(null);

    const systemInstruction = "You are an AI statistical analysis engine. Based on the data and user's test/graph selections, generate a detailed report. Include results, interpretations, and markdown tables.";
    const dataSampleForPrompt = `Data Sample (first 3 rows):\n${JSON.stringify(dataPreview.slice(0,3), null, 2)}\nData Columns: ${Object.keys(dataPreview[0]).join(', ')}`;
    
    const descriptiveText = selectedDescriptives.map(id => DESCRIPTIVE_STATS.find(d => d.id === id)?.name).join(', ') || 'None selected.';
    const inferentialText = selectedInferentials.map(id => INFERENTIAL_TESTS.find(t => t.id === id)?.name).join(', ') || 'None selected.';
    const graphText = graphConfigs.map(g => `- A ${g.type} chart for Y-axis:'${g.variables.y}' and X-axis:'${g.variables.x}'` + (g.variables.group ? ` grouped by '${g.variables.group}'` : '')).join('\n') || 'None requested.';

    const prompt = `Analysis Plan:
    ---
    Descriptive Statistics to run: ${descriptiveText}
    Inferential Tests to run: ${inferentialText}
    Graphs to generate/describe: \n${graphText}
    ---
    Data Context:
    ${dataSampleForPrompt}
    
    Execute this plan. For each test, provide the result and a brief interpretation. Format tables in Markdown. Provide a summary for each requested graph.`;
    
    const response = await generateText(prompt, systemInstruction, false);

    if (response.text && !response.error) {
        const newAnalysisResults = { 
            plan: `Descriptives: ${descriptiveText}. Inferentials: ${inferentialText}.`,
            results: response.text, 
            tables: "See results section for Markdown tables.",
            isValidated: false,
            testTypes: selectedInferentials,
            measuresToReport: selectedDescriptives,
        };
        setStatisticalResults(newAnalysisResults);
        updateAnalysis(newAnalysisResults);
        setNotification({ message: "AI statistical analysis performed. Results ready for review.", type: 'info' });
    } else {
      setError(response.error || "Failed to perform AI statistical analysis.");
      setNotification({ message: `Error: ${response.error}`, type: 'error' });
    }
    setIsLoading(false);
  };
  
  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  const addGraphConfig = () => {
    setGraphConfigs(prev => [...prev, { id: `graph_${Date.now()}`, type: 'Bar', variables: { x: '', y: '', group: '' } }]);
  };

  const updateGraphConfig = (id: string, field: 'type' | 'variables', value: any) => {
    setGraphConfigs(prev => prev.map(g => g.id === id ? (field === 'type' ? { ...g, type: value } : { ...g, variables: { ...g.variables, ...value } }) : g));
  };
  
  const removeGraphConfig = (id: string) => {
    setGraphConfigs(prev => prev.filter(g => g.id !== id));
  };
  
  const validateAnalysis = () => {
    if (!currentProject || !currentProject.analysis) return;
    updateAnalysis({ isValidated: true, statisticianInterpretation: statisticalResults.statisticianInterpretation || "Validated by Statistician." });
    setNotification({ message: "Statistical analysis validated by Statistician (Simulated).", type: 'success' });
  };

  const proceedToManuscript = () => {
    setProjectStage(ModuleStage.MANUSCRIPT_WRITING);
    navigate('/manuscript');
  };

  const parseCSV = (csvText: string): Record<string, any>[] => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== headers.length || lines[i].trim() === '') continue;
        
        const rowObject: Record<string, any> = {};
        headers.forEach((header, j) => {
            rowObject[header] = values[j]?.trim();
        });
        data.push(rowObject);
    }
    return data;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setNotification({ message: 'Please upload a valid .csv file.', type: 'error' });
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
            const parsedData = parseCSV(text);
            if(parsedData.length === 0) {
                 setNotification({ message: 'CSV file is empty or malformed. Please ensure it has a header row and data.', type: 'error' });
                 return;
            }
            setDataPreview(parsedData);
            updateDataSet({ simulatedData: parsedData, name: `Uploaded: ${file.name}` });
            setNotification({ message: `Successfully loaded and previewing "${file.name}".`, type: 'success' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setNotification({ message: `Failed to parse CSV file: ${errorMessage}`, type: 'error' });
            console.error("CSV Parsing Error:", err);
        }
    };
    reader.onerror = () => {
        setNotification({ message: `Error reading file: ${reader.error}`, type: 'error'});
    };
    reader.readAsText(file);
  };

  const isStatistician = currentUser?.role === UserRole.STATISTICIAN;
  const canQuery = currentUser?.role === UserRole.HCP || currentUser?.role === UserRole.RESEARCHER || isStatistician;
  const chartTextColor = '#374151';
  const dataKeys = dataPreview ? Object.keys(dataPreview[0] || {}) : [];

  if (!currentProject) {
    return (
      <ModuleWrapper title="Data Collection, Aggregation & Analysis" icon={<TableCellsIcon />}>
        <StartProjectPrompt moduleName="Data & Analysis" />
      </ModuleWrapper>
    );
  }

  const renderDynamicGraph = () => {
    if (graphConfigs.length === 0 || !dataPreview) return <p className="text-gray-500">Configure a graph to see a preview.</p>;
    
    const config = graphConfigs[0];
    const { type, variables } = config;
    const { x, y } = variables;

    if (!x || !y) return <p className="text-gray-500">Select X and Y variables for your graph.</p>;

    switch(type) {
      case 'Bar':
      case 'Histogram':
        return (
            <BarChart data={dataPreview} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB"/>
                <XAxis dataKey={x} tick={{ fill: chartTextColor }} label={{ value: x, position: 'insideBottom', offset: -10 }}/>
                <YAxis tick={{ fill: chartTextColor }} label={{ value: y, angle: -90, position: 'insideLeft' }}/>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid #E5E7EB`}} />
                <Legend />
                <Bar dataKey={y} fill="#3b82f6" name={y} />
            </BarChart>
        );
      case 'Line':
        return (
            <LineChart data={dataPreview} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB"/>
                <XAxis dataKey={x} tick={{ fill: chartTextColor }} label={{ value: x, position: 'insideBottom', offset: -10 }}/>
                <YAxis tick={{ fill: chartTextColor }} label={{ value: y, angle: -90, position: 'insideLeft' }}/>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid #E5E7EB`}} />
                <Legend />
                <Line type="monotone" dataKey={y} stroke="#3b82f6" name={y} />
            </LineChart>
        );
      case 'Scatter':
        return (
            <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB"/>
                <XAxis type="category" dataKey={x} name={x} tick={{ fill: chartTextColor }} label={{ value: x, position: 'insideBottom', offset: -10 }}/>
                <YAxis type="number" dataKey={y} name={y} tick={{ fill: chartTextColor }} label={{ value: y, angle: -90, position: 'insideLeft' }}/>
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid #E5E7EB`}} />
                <Scatter name="Data points" data={dataPreview} fill="#3b82f6" />
            </ScatterChart>
        );
      default:
        return <p className="text-gray-500">Preview for '{type}' chart type is not yet available. AI will still generate an interpretation.</p>;
    }
  };
  
  return (
    <ModuleWrapper title="Data Collection, Aggregation & Analysis" icon={<TableCellsIcon />} subtitle={`For project: ${currentProject.title}`}>
      {notification && <NotificationBanner type={notification.type} message={notification.message} onDismiss={() => setNotification(null)} />}
      {error && <NotificationBanner type="error" message={error} onDismiss={clearError} />}

      {showMeetingPlaceholder && (
          <Card title="Data Planning Meeting" icon={<BellIcon />} className="mb-6 bg-info-light border-info-light">
              <p className="text-info-textLight">
                  A Statistician (<strong>{MOCK_USERS.find(u => u.id === currentProject.assignedStatistician)?.name || 'Expert'}</strong>) is assigned.
                  A (simulated) collaborative meeting should occur.
              </p>
              <Button onClick={() => setShowMeetingPlaceholder(false)} size="sm" variant="secondary" className="mt-3">Mark as Met (Simulated)</Button>
          </Card>
      )}

      {/* --- Data Input Section --- */}
      <Card title="Data Input" icon={<SquaresPlusIcon/>} className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-semibold text-gray-700">Option 1: AI-Powered Query Generation</h4>
              <TextInput label="Describe Data Requirements (Natural Language)" value={naturalLanguageQuery} onChange={e => setNaturalLanguageQuery(e.target.value)} placeholder="e.g., Extract age, gender, and latest HbA1c..." disabled={isLoading || !canQuery}/>
              <Button onClick={handleQueryGeneration} isLoading={isLoading} disabled={!naturalLanguageQuery.trim() || !canQuery} leftIcon={<SparklesIcon />} variant="secondary">Generate SQL Query</Button>
              {generatedSQL && (
                <div className="mt-4">
                  <h5 className="font-semibold text-gray-700 text-sm">Generated SQL Query (for review):</h5>
                  <pre className="bg-gray-900 text-white p-2 rounded-md text-xs overflow-x-auto my-2"><code>{generatedSQL}</code></pre>
                  <Button onClick={simulateDataExtraction} isLoading={isLoading} size="sm" variant="ghost">Simulate Data Extraction</Button>
                </div>
              )}
            </div>
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-semibold text-gray-700">Option 2: Upload Existing Dataset</h4>
                <p className="text-sm text-gray-600">Upload your own data in CSV format for analysis.</p>
                <div>
                    <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 mb-1">Select CSV File</label>
                    <input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50" disabled={isLoading} />
                </div>
                 {!canQuery && <p className="text-sm text-red-500">You do not have permission to upload or query data.</p>}
            </div>
        </div>
      </Card>
      
      {/* --- Data Preview Section --- */}
      {dataPreview && (
        <Card title="Data Preview" className="mb-6">
          <p className="text-sm text-gray-600 mb-2">A sample of the provided data ({currentProject.dataSet?.name || ''}). Column names: <strong>{dataKeys.join(', ')}</strong></p>
          <div className="overflow-x-auto max-h-60 border border-gray-200 rounded-md">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr>{dataKeys.map(key => (<th key={key} className="px-4 py-2 text-left font-medium text-gray-500 tracking-wider">{key}</th>))}</tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">{dataPreview.slice(0, 5).map((row, index) => (<tr key={index} className="hover:bg-gray-50">{Object.values(row).map((value, i) => (<td key={i} className="px-4 py-2 whitespace-nowrap text-gray-700">{String(value)}</td>))}</tr>))}</tbody>
            </table>
          </div>
           {dataPreview.length > 5 && <p className="text-xs text-gray-500 mt-1">Showing first 5 of {dataPreview.length} rows.</p>}
        </Card>
      )}
      
      {/* --- Analysis Configuration Section --- */}
      <Card title="Statistical Analysis Configuration" icon={<BeakerIcon/>} className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Statistical Tests */}
            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800">1. Select Statistical Tests</h4>
                {!isStatistician && <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded-md">Only Statisticians can modify these selections. Your current selections will be used.</p>}
                
                <div className="space-y-3">
                    <h5 className="font-semibold text-gray-700">Descriptive Statistics</h5>
                    {DESCRIPTIVE_STATS.map(stat => (
                        <div key={stat.id} className="flex items-center">
                            <input id={stat.id} type="checkbox" checked={selectedDescriptives.includes(stat.id)} onChange={() => handleCheckboxChange(setSelectedDescriptives, stat.id)} disabled={!isStatistician || isLoading} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/>
                            <label htmlFor={stat.id} className="ml-3 text-sm text-gray-600">{stat.name}</label>
                        </div>
                    ))}
                </div>
                <div className="space-y-3">
                    <h5 className="font-semibold text-gray-700">Inferential Tests</h5>
                    {INFERENTIAL_TESTS.map(test => (
                        <div key={test.id} className="flex items-start">
                             <input id={test.id} type="checkbox" checked={selectedInferentials.includes(test.id)} onChange={() => handleCheckboxChange(setSelectedInferentials, test.id)} disabled={!isStatistician || isLoading} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mt-1"/>
                            <div className="ml-3">
                                <label htmlFor={test.id} className="text-sm font-medium text-gray-700">{test.name}</label>
                                <p className="text-xs text-gray-500">{test.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Graph Builder */}
            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800">2. Build Graphs</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {graphConfigs.map((config, index) => (
                    <div key={config.id} className="p-3 border rounded-lg bg-gray-50 relative space-y-2">
                        <button onClick={() => removeGraphConfig(config.id)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600"><XCircleIcon className="h-5 w-5"/></button>
                        <p className="font-medium text-sm text-gray-800">Graph {index + 1}</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-medium text-gray-600">Type</label>
                                <select value={config.type} onChange={(e) => updateGraphConfig(config.id, 'type', e.target.value)} disabled={isLoading || !isStatistician} className="w-full text-xs p-1 border-gray-300 rounded-md">
                                    {GRAPH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="text-xs font-medium text-gray-600">X-Axis Variable</label>
                                <select value={config.variables.x} onChange={e => updateGraphConfig(config.id, 'variables', { x: e.target.value })} disabled={isLoading || !isStatistician || dataKeys.length === 0} className="w-full text-xs p-1 border-gray-300 rounded-md">
                                    <option value="">Select...</option>
                                    {dataKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Y-Axis Variable</label>
                                <select value={config.variables.y} onChange={e => updateGraphConfig(config.id, 'variables', { y: e.target.value })} disabled={isLoading || !isStatistician || dataKeys.length === 0} className="w-full text-xs p-1 border-gray-300 rounded-md">
                                    <option value="">Select...</option>
                                    {dataKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Group By (Optional)</label>
                                <select value={config.variables.group} onChange={e => updateGraphConfig(config.id, 'variables', { group: e.target.value })} disabled={isLoading || !isStatistician || dataKeys.length === 0} className="w-full text-xs p-1 border-gray-300 rounded-md">
                                    <option value="">None</option>
                                    {dataKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
                </div>
                <Button onClick={addGraphConfig} size="sm" variant="ghost" disabled={isLoading || !isStatistician}>Add Another Graph</Button>
            </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <Button onClick={handleStatisticalAnalysis} isLoading={isLoading} disabled={!isStatistician || (!selectedDescriptives.length && !selectedInferentials.length)} variant="primary" size="lg">
                Perform AI Statistical Analysis
            </Button>
        </div>
      </Card>
      
      {isLoading && !statisticalResults.results && <LoadingSpinner message="AI performing analysis..." />}

      {statisticalResults.results && (
        <div className="mt-6 space-y-6">
            <Card title="AI Generated Statistical Output">
              <div className="prose prose-sm max-w-none p-3 border rounded-md bg-gray-50 overflow-auto max-h-96 whitespace-pre-wrap">
                {statisticalResults.results}
              </div>
            </Card>
            
            <Card title="Simulated Visualization (Preview of First Graph)">
              <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      {renderDynamicGraph()}
                  </ResponsiveContainer>
              </div>
            </Card>

          {isStatistician && (
            <Card title="Statistician Validation">
                <TextInput
                    label="Statistician's Interpretation & Validation Notes"
                    value={statisticalResults.statisticianInterpretation || ''}
                    onChange={e => setStatisticalResults(prev => ({ ...prev, statisticianInterpretation: e.target.value }))}
                    placeholder="Provide substantive interpretation of AI results. Note any corrections or validation points."
                    disabled={isLoading}
                />
                <Button onClick={validateAnalysis} isLoading={isLoading} disabled={statisticalResults.isValidated} leftIcon={<CheckCircleIcon />} variant="secondary" className="mt-3">
                {statisticalResults.isValidated ? "Analysis Validated" : "Validate Analysis"}
                </Button>
            </Card>
          )}
           {!isStatistician && statisticalResults.isValidated && (
               <p className="text-sm text-success-textLight flex items-center"><CheckCircleIcon className="h-5 w-5 mr-1 text-success"/> Analysis validated by Statistician.</p>
           )}
        </div>
      )}

      
      <Button onClick={proceedToManuscript} isLoading={isLoading} className="mt-6" variant="primary">
          Proceed to Manuscript Writing
      </Button>
      
    </ModuleWrapper>
  );
};
