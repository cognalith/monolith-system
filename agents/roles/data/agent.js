/**
 * MONOLITH OS - Data Engineering Lead Agent
 * Data pipelines, analytics, and data operations
 *
 * Responsibilities:
 * - Data pipeline design and management
 * - Data warehouse and lake architecture
 * - Analytics infrastructure
 * - Data quality and governance
 * - ML/AI data operations
 */

import RoleAgent from '../../core/RoleAgent.js';

const DATA_CONFIG = {
  roleId: 'data',
  roleName: 'Data Engineering Lead',
  roleAbbr: 'Data',
  tier: 3,

  responsibilities: [
    'Design and maintain data pipelines',
    'Manage data warehouse architecture',
    'Ensure data quality and governance',
    'Support analytics and reporting',
    'Enable ML/AI data operations',
    'Optimize data storage and processing',
    'Implement data security practices',
  ],

  authorityLimits: {
    maxApprovalAmount: 5000,
    canModifyPipelines: true,
    canAccessPII: false, // Requires approval
    canDeployDataChanges: true,
    requiresCTOFor: ['new data systems', 'PII access', 'major schema changes'],
  },

  reportsTo: 'cto',
  directReports: ['data-engineers', 'analysts'],

  roleDescription: `You are the Data Engineering Lead, responsible for data infrastructure and operations.

Your core competencies:
1. Data Pipelines - ETL/ELT design and maintenance
2. Data Architecture - Warehouse, lake, lakehouse design
3. Data Quality - Validation, testing, monitoring
4. Analytics - Enable self-service analytics
5. ML Ops - Support data for ML/AI systems

Decision Framework:
- Approve data-related expenses up to $5,000
- Modify data pipelines and schemas
- Implement data quality measures
- Escalate PII access and new systems to CTO
- Coordinate with CISO on data security
- Work with product on analytics needs`,
};

class DataEngineeringAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...DATA_CONFIG, ...config });

    // Data-specific state
    this.pipelines = [];
    this.dataModels = new Map();
    this.qualityIssues = [];
  }

  /**
   * Design data pipeline
   */
  async designPipeline(requirements) {
    const pipelinePrompt = `Design a data pipeline for these requirements.

## Requirements:
${JSON.stringify(requirements, null, 2)}

## Pipeline Components:
1. **Source**
   - Data sources
   - Ingestion method (batch/streaming)
   - Schema definition

2. **Transform**
   - Transformation logic
   - Data cleansing rules
   - Aggregations

3. **Load**
   - Target destination
   - Load strategy (full/incremental)
   - Partitioning

4. **Quality**
   - Validation rules
   - Data quality checks
   - Error handling

5. **Orchestration**
   - Schedule
   - Dependencies
   - Monitoring

## Output:
1. Pipeline architecture
2. Data flow diagram description
3. Technology recommendations
4. Implementation steps
5. Monitoring plan`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: pipelinePrompt,
      temperature: 0.5,
    });

    return {
      pipeline: response.content,
      requirements,
      designedAt: new Date().toISOString(),
    };
  }

  /**
   * Design data model
   */
  async designDataModel(requirements) {
    const modelPrompt = `Design a data model for these requirements.

## Requirements:
${JSON.stringify(requirements, null, 2)}

## Data Model Elements:
1. **Entities**
   - Core entities
   - Relationships
   - Cardinality

2. **Schema Design**
   - Table structure
   - Column definitions
   - Data types

3. **Normalization**
   - Normalization level
   - Denormalization for performance

4. **Indexing**
   - Primary keys
   - Foreign keys
   - Secondary indexes

5. **Partitioning**
   - Partition strategy
   - Archive strategy

## Output:
1. Entity relationship description
2. Schema definitions
3. Performance considerations
4. Migration strategy
5. Documentation`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: modelPrompt,
      temperature: 0.5,
    });

    return {
      model: response.content,
      requirements,
      designedAt: new Date().toISOString(),
    };
  }

  /**
   * Assess data quality
   */
  async assessDataQuality(data) {
    const qualityPrompt = `Assess data quality for this dataset.

## Dataset Information:
${JSON.stringify(data, null, 2)}

## Quality Dimensions:
1. **Completeness**
   - Missing values
   - Coverage

2. **Accuracy**
   - Data correctness
   - Validation against source

3. **Consistency**
   - Cross-system consistency
   - Format consistency

4. **Timeliness**
   - Data freshness
   - Update frequency

5. **Uniqueness**
   - Duplicate detection
   - Entity resolution

6. **Validity**
   - Business rule compliance
   - Format validation

## Output:
1. Quality score by dimension
2. Issues identified
3. Root cause analysis
4. Remediation recommendations
5. Prevention measures`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: qualityPrompt,
      temperature: 0.4,
    });

    return {
      assessment: response.content,
      data,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Plan analytics implementation
   */
  async planAnalytics(requirements) {
    const analyticsPrompt = `Plan analytics implementation for these requirements.

## Requirements:
${JSON.stringify(requirements, null, 2)}

## Analytics Components:
1. **Data Sources**
   - Required data
   - Data availability
   - Gaps to fill

2. **Metrics & KPIs**
   - Key metrics
   - Calculations
   - Dimensions

3. **Reporting**
   - Dashboard design
   - Report types
   - Self-service options

4. **Technology**
   - BI tool selection
   - Data warehouse
   - Caching layer

5. **Access**
   - User roles
   - Security
   - Governance

## Output:
1. Analytics architecture
2. Data requirements
3. Dashboard mockup descriptions
4. Implementation roadmap
5. Resource needs`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analyticsPrompt,
      temperature: 0.5,
    });

    return {
      plan: response.content,
      requirements,
      plannedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for Data-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const dataKeywords = [
      'data pipeline', 'etl', 'elt', 'data warehouse', 'data lake',
      'analytics', 'dashboard', 'report', 'metrics', 'kpi',
      'database', 'schema', 'migration', 'data quality',
      'bigquery', 'snowflake', 'redshift', 'databricks', 'airflow'
    ];

    if (dataKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default DataEngineeringAgent;
export { DATA_CONFIG };
