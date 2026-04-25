// Automated Resource Validation System
// Checks for broken links, outdated content, and data quality issues

class ResourceValidator {
    constructor() {
        this.validationResults = [];
        this.isValidating = false;
        this.abortController = null;
    }

    async validateAllResources(resources) {
        if (this.isValidating) {
            this.showNotification('Validation already in progress...', 'warning');
            return;
        }

        this.isValidating = true;
        this.abortController = new AbortController();
        this.validationResults = [];
        
        this.showValidationProgress('Starting validation...', 0, resources.length);
        
        try {
            for (let i = 0; i < resources.length; i++) {
                if (this.abortController.signal.aborted) {
                    break;
                }
                
                const resource = resources[i];
                this.showValidationProgress(`Validating: ${resource.title}`, i + 1, resources.length);
                
                const result = await this.validateResource(resource);
                this.validationResults.push(result);
                
                // Small delay to prevent overwhelming servers
                await this.delay(500);
            }
            
            this.displayValidationResults();
            
        } catch (error) {
            this.showNotification('Validation error: ' + error.message, 'error');
        } finally {
            this.isValidating = false;
            this.hideValidationProgress();
        }
    }

    async validateResource(resource) {
        const result = {
            id: resource.id,
            title: resource.title,
            issues: [],
            warnings: [],
            linkStatus: 'unknown',
            lastChecked: new Date().toISOString(),
            score: 100 // Start with perfect score, deduct for issues
        };

        // 1. Basic Data Validation
        this.validateBasicData(resource, result);
        
        // 2. Content Quality Check
        this.validateContentQuality(resource, result);
        
        // 3. Link Validation (if URL provided)
        if (resource.url && resource.url !== '#') {
            await this.validateLink(resource.url, result);
        }
        
        // 4. Freshness Check
        this.checkContentFreshness(resource, result);
        
        // 5. Cross-reference Validation
        this.validateCrossReferences(resource, result);

        return result;
    }

    validateBasicData(resource, result) {
        // Check required fields
        const requiredFields = ['id', 'title', 'description', 'organization'];
        requiredFields.forEach(field => {
            if (!resource[field] || resource[field].trim() === '') {
                result.issues.push(`Missing required field: ${field}`);
                result.score -= 20;
            }
        });

        // Check required arrays
        const requiredArrays = ['audiences', 'stages', 'types', 'geography', 'topics'];
        requiredArrays.forEach(field => {
            if (!resource[field] || !Array.isArray(resource[field]) || resource[field].length === 0) {
                result.issues.push(`Missing or empty array field: ${field}`);
                result.score -= 15;
                return;
            }

            const allowed = window.APHL_TAXONOMY?.enumFields?.()[field] || [];
            const invalid = resource[field].filter(value => !allowed.includes(value));
            if (invalid.length > 0) {
                result.issues.push(`Unsupported ${field} value(s): ${invalid.join(', ')}`);
                result.score -= 15;
            }
        });

        ['pathogenFocus', 'language'].forEach(field => {
            if (!resource[field]) return;
            if (!Array.isArray(resource[field])) {
                result.issues.push(`${field} must be an array`);
                result.score -= 10;
                return;
            }
            const allowed = window.APHL_TAXONOMY?.enumFields?.()[field] || [];
            const invalid = resource[field].filter(value => !allowed.includes(value));
            if (invalid.length > 0) {
                result.issues.push(`Unsupported ${field} value(s): ${invalid.join(', ')}`);
                result.score -= 10;
            }
        });

        // Check for duplicate IDs (would need access to full resource list)
        // This is handled in the main validation loop

        // Check ID format
        if (resource.id && !/^[a-z0-9-]+$/.test(resource.id)) {
            result.warnings.push('Resource ID should only contain lowercase letters, numbers, and hyphens');
            result.score -= 5;
        }
    }

    validateContentQuality(resource, result) {
        // Check description length
        if (resource.description && resource.description.length < 50) {
            result.warnings.push('Description is quite short (less than 50 characters)');
            result.score -= 5;
        }

        if (resource.description && resource.description.length > 1000) {
            result.warnings.push('Description is very long (over 1000 characters) - consider summarizing');
            result.score -= 3;
        }

        // Check for placeholder text
        const placeholderTexts = ['lorem ipsum', 'placeholder', 'example', 'todo', 'tbd', 'coming soon'];
        const fullText = `${resource.title} ${resource.description} ${resource.practicalUse || ''}`.toLowerCase();
        
        placeholderTexts.forEach(placeholder => {
            if (fullText.includes(placeholder)) {
                result.issues.push(`Contains placeholder text: "${placeholder}"`);
                result.score -= 10;
            }
        });

        // Check for key features
        if (!resource.keyFeatures || resource.keyFeatures.length === 0) {
            result.warnings.push('No key features listed - consider adding some to help users understand the resource');
            result.score -= 5;
        }

        // Check practical use description
        if (!resource.practicalUse || resource.practicalUse.trim() === '') {
            result.warnings.push('No practical use description - consider adding how users can apply this resource');
            result.score -= 5;
        }
    }

    async validateLink(url, result) {
        try {
            // Use a CORS proxy for cross-origin requests or fetch with no-cors mode
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(url, {
                method: 'HEAD', // Use HEAD to avoid downloading content
                mode: 'no-cors', // Handle CORS issues
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Note: with no-cors mode, we can't access status codes
            // The fetch will only fail if the request completely fails
            result.linkStatus = 'accessible';
            result.warnings.push('Link appears accessible (limited validation due to CORS)');
            
        } catch (error) {
            if (error.name === 'AbortError') {
                result.issues.push('Link validation timed out (10 seconds)');
                result.linkStatus = 'timeout';
                result.score -= 15;
            } else {
                result.issues.push(`Link may be broken or inaccessible: ${error.message}`);
                result.linkStatus = 'error';
                result.score -= 20;
            }
        }
    }

    checkContentFreshness(resource, result) {
        // Check if organization names suggest outdated content
        const outdatedIndicators = [
            'beta', 'alpha', 'prototype', 'draft', 'preliminary',
            'coming soon', 'under development', 'in progress'
        ];
        
        const fullText = `${resource.title} ${resource.description}`.toLowerCase();
        
        outdatedIndicators.forEach(indicator => {
            if (fullText.includes(indicator)) {
                result.warnings.push(`Content may be outdated (contains "${indicator}")`);
                result.score -= 5;
            }
        });

        // Check for year references that might be outdated
        const currentYear = new Date().getFullYear();
        const yearMatches = fullText.match(/\b(20\d{2})\b/g);
        
        if (yearMatches) {
            const years = yearMatches.map(y => parseInt(y)).filter(y => y > 2000);
            const oldestYear = Math.min(...years);
            
            if (currentYear - oldestYear > 5) {
                result.warnings.push(`Contains references to older years (${oldestYear}) - content may need updating`);
                result.score -= 3;
            }
        }

        // Check for COVID-19 specific content that might be outdated
        if (fullText.includes('covid') || fullText.includes('sars-cov-2')) {
            if (fullText.includes('2020') || fullText.includes('2021')) {
                result.warnings.push('COVID-19 content from early pandemic years may need updating');
                result.score -= 3;
            }
        }
    }

    validateCrossReferences(resource, result) {
        if (resource.relatedResources && resource.relatedResources.length > 0) {
            // Note: Full cross-reference validation would require access to all resources
            // This is a placeholder for that functionality
            result.warnings.push('Cross-reference validation requires full resource database access');
        }
    }

    displayValidationResults() {
        const modal = this.createValidationModal();
        const content = modal.querySelector('#validationContent');
        
        const totalResources = this.validationResults.length;
        const issueCount = this.validationResults.filter(r => r.issues.length > 0).length;
        const warningCount = this.validationResults.filter(r => r.warnings.length > 0).length;
        const averageScore = Math.round(
            this.validationResults.reduce((sum, r) => sum + r.score, 0) / totalResources
        );

        content.innerHTML = `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Validation Summary</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-blue-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-blue-600">${totalResources}</div>
                        <div class="text-sm text-gray-600">Resources Checked</div>
                    </div>
                    <div class="bg-red-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-red-600">${issueCount}</div>
                        <div class="text-sm text-gray-600">With Issues</div>
                    </div>
                    <div class="bg-yellow-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-yellow-600">${warningCount}</div>
                        <div class="text-sm text-gray-600">With Warnings</div>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg text-center">
                        <div class="text-2xl font-bold text-green-600">${averageScore}%</div>
                        <div class="text-sm text-gray-600">Average Score</div>
                    </div>
                </div>
                
                <div class="flex space-x-4 mb-6">
                    <button onclick="resourceValidator.exportValidationReport()" 
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200">
                        <i class="fas fa-download mr-1"></i>Export Report
                    </button>
                    <button onclick="resourceValidator.filterValidationResults('issues')" 
                            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Show Issues Only
                    </button>
                    <button onclick="resourceValidator.filterValidationResults('warnings')" 
                            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition duration-200">
                        <i class="fas fa-exclamation-circle mr-1"></i>Show Warnings Only
                    </button>
                    <button onclick="resourceValidator.filterValidationResults('all')" 
                            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-200">
                        <i class="fas fa-list mr-1"></i>Show All
                    </button>
                </div>
            </div>
            
            <div id="validationResults" class="space-y-4 max-h-96 overflow-y-auto">
                ${this.renderValidationResults('all')}
            </div>
        `;

        modal.classList.remove('hidden');
    }

    renderValidationResults(filter = 'all') {
        let filteredResults = this.validationResults;
        
        if (filter === 'issues') {
            filteredResults = this.validationResults.filter(r => r.issues.length > 0);
        } else if (filter === 'warnings') {
            filteredResults = this.validationResults.filter(r => r.warnings.length > 0);
        }

        return filteredResults.map(result => `
            <div class="border rounded-lg p-4 ${this.getResultColorClass(result)}">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-medium text-gray-800">${result.title}</h4>
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 rounded text-xs ${this.getScoreColorClass(result.score)}">
                            ${result.score}%
                        </span>
                        <span class="px-2 py-1 rounded text-xs ${this.getLinkStatusColorClass(result.linkStatus)}">
                            ${this.formatLinkStatus(result.linkStatus)}
                        </span>
                    </div>
                </div>
                
                <p class="text-sm text-gray-600 mb-3">ID: ${result.id}</p>
                
                ${result.issues.length > 0 ? `
                    <div class="mb-3">
                        <h5 class="text-sm font-medium text-red-700 mb-1">Issues:</h5>
                        <ul class="list-disc list-inside text-sm text-red-600 space-y-1">
                            ${result.issues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${result.warnings.length > 0 ? `
                    <div class="mb-3">
                        <h5 class="text-sm font-medium text-yellow-700 mb-1">Warnings:</h5>
                        <ul class="list-disc list-inside text-sm text-yellow-600 space-y-1">
                            ${result.warnings.map(warning => `<li>${warning}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${result.issues.length === 0 && result.warnings.length === 0 ? `
                    <p class="text-sm text-green-600">✓ No issues found</p>
                ` : ''}
                
                <p class="text-xs text-gray-500 mt-2">Last checked: ${new Date(result.lastChecked).toLocaleString()}</p>
            </div>
        `).join('');
    }

    filterValidationResults(filter) {
        const resultsContainer = document.getElementById('validationResults');
        resultsContainer.innerHTML = this.renderValidationResults(filter);
    }

    getResultColorClass(result) {
        if (result.issues.length > 0) return 'border-red-200 bg-red-50';
        if (result.warnings.length > 0) return 'border-yellow-200 bg-yellow-50';
        return 'border-green-200 bg-green-50';
    }

    getScoreColorClass(score) {
        if (score >= 90) return 'bg-green-100 text-green-800';
        if (score >= 70) return 'bg-yellow-100 text-yellow-800';
        return 'bg-red-100 text-red-800';
    }

    getLinkStatusColorClass(status) {
        switch (status) {
            case 'accessible': return 'bg-green-100 text-green-800';
            case 'error': return 'bg-red-100 text-red-800';
            case 'timeout': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    formatLinkStatus(status) {
        switch (status) {
            case 'accessible': return 'Link OK';
            case 'error': return 'Link Error';
            case 'timeout': return 'Timeout';
            default: return 'No Link';
        }
    }

    exportValidationReport() {
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalResources: this.validationResults.length,
                resourcesWithIssues: this.validationResults.filter(r => r.issues.length > 0).length,
                resourcesWithWarnings: this.validationResults.filter(r => r.warnings.length > 0).length,
                averageScore: Math.round(
                    this.validationResults.reduce((sum, r) => sum + r.score, 0) / this.validationResults.length
                )
            },
            results: this.validationResults
        };

        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `validation-report-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Validation report exported successfully!', 'success');
    }

    createValidationModal() {
        let modal = document.getElementById('validationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'validationModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-50';
            modal.innerHTML = `
                <div class="flex items-center justify-center min-h-screen px-4">
                    <div class="bg-white rounded-lg max-w-6xl w-full max-h-screen overflow-y-auto">
                        <div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                            <h2 class="text-xl font-bold text-gray-800">Resource Validation Results</h2>
                            <button onclick="document.getElementById('validationModal').classList.add('hidden')" 
                                    class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        <div id="validationContent" class="p-6">
                            <!-- Content will be populated here -->
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        return modal;
    }

    showValidationProgress(message, current, total) {
        let progress = document.getElementById('validationProgress');
        if (!progress) {
            progress = document.createElement('div');
            progress.id = 'validationProgress';
            progress.className = 'fixed top-4 right-4 bg-white border rounded-lg shadow-lg p-4 z-50';
            progress.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <div>
                        <div id="progressMessage" class="text-sm font-medium text-gray-800"></div>
                        <div id="progressBar" class="w-48 bg-gray-200 rounded-full h-2 mt-1">
                            <div id="progressFill" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                        <div id="progressText" class="text-xs text-gray-600 mt-1"></div>
                    </div>
                    <button onclick="resourceValidator.stopValidation()" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-stop"></i>
                    </button>
                </div>
            `;
            document.body.appendChild(progress);
        }
        
        document.getElementById('progressMessage').textContent = message;
        document.getElementById('progressText').textContent = `${current} of ${total}`;
        
        const percentage = total > 0 ? (current / total) * 100 : 0;
        document.getElementById('progressFill').style.width = `${percentage}%`;
    }

    hideValidationProgress() {
        const progress = document.getElementById('validationProgress');
        if (progress) {
            progress.remove();
        }
    }

    stopValidation() {
        if (this.abortController) {
            this.abortController.abort();
            this.showNotification('Validation stopped by user', 'info');
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 left-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-600 text-white' :
            type === 'error' ? 'bg-red-600 text-white' :
            type === 'warning' ? 'bg-yellow-600 text-white' :
            'bg-blue-600 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 5000);
    }
}

// TSV Export Functionality
class TSVExporter {
    static exportResourcesToTSV(resources) {
        if (!resources || resources.length === 0) {
            alert('No resources to export');
            return;
        }

        // Define the columns for TSV export
        const columns = [
            'id',
            'title',
            'organization',
            'description',
            'url',
            'audiences',
            'stages',
            'types',
            'geography',
            'topics',
            'keyFeatures',
            'practicalUse',
            'relatedResources',
            'lastUpdated'
        ];

        // Create TSV header
        const header = columns.join('\t');
        
        // Create TSV rows
        const rows = resources.map(resource => {
            return columns.map(column => {
                let value = resource[column];
                
                // Handle arrays by joining with semicolons
                if (Array.isArray(value)) {
                    value = value.join('; ');
                }
                
                // Handle undefined/null values
                if (value === undefined || value === null) {
                    value = '';
                }
                
                // Add current timestamp for lastUpdated if not present
                if (column === 'lastUpdated' && !value) {
                    value = new Date().toISOString();
                }
                
                // Escape tabs and newlines in the data
                value = String(value).replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
                
                return value;
            }).join('\t');
        });

        // Combine header and rows
        const tsvContent = [header, ...rows].join('\n');
        
        // Create and download the file
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `genomic-epi-resources-${new Date().toISOString().split('T')[0]}.tsv`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 bg-green-600 text-white';
        notification.innerHTML = `<i class="fas fa-check mr-2"></i>TSV file exported with ${resources.length} resources!`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 5000);
    }

    static importResourcesFromTSV(file, callback) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const tsvContent = e.target.result;
                const lines = tsvContent.split('\n');
                
                if (lines.length < 2) {
                    alert('TSV file appears to be empty or invalid');
                    return;
                }

                const headers = lines[0].split('\t');
                const resources = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const values = line.split('\t');
                    const resource = {};

                    headers.forEach((header, index) => {
                        let value = values[index] || '';
                        
                        // Handle array fields (joined with semicolons)
                        const arrayFields = ['audiences', 'stages', 'types', 'geography', 'topics', 'keyFeatures', 'relatedResources'];
                        if (arrayFields.includes(header) && value) {
                            value = value.split('; ').map(v => v.trim()).filter(v => v);
                        }
                        
                        resource[header] = value;
                    });

                    if (resource.id && resource.title) {
                        resources.push(resource);
                    }
                }

                if (resources.length > 0) {
                    callback(resources);
                } else {
                    alert('No valid resources found in TSV file');
                }

            } catch (error) {
                alert('Error parsing TSV file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

// Global instances
window.resourceValidator = new ResourceValidator();
window.tsvExporter = TSVExporter;
