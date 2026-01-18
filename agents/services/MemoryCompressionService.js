/**
 * MONOLITH OS - Memory Compression Service
 * Phase 11: Event Log & Memory Implementation
 *
 * Manages agent context windows by compressing old conversations
 * and preserving key learnings while reducing token usage.
 *
 * Capabilities:
 * - Compress old conversations into summaries
 * - Track compression history and ratios
 * - Maintain agent knowledge continuity
 * - Automatic daily compression scheduling
 */

import LLMRouter from '../core/LLMRouter.js';
import { createClient } from '@supabase/supabase-js';

// Compression system prompt
const COMPRESSION_SYSTEM_PROMPT = `You are a Memory Compression Agent for MONOLITH OS.

Your job is to compress multiple conversations into a concise summary while preserving:
1. **Key decisions** made during conversations
2. **Important facts** learned
3. **Action items** or commitments
4. **Context** that may be needed for future tasks

## Compression Guidelines:
- Remove redundant information and pleasantries
- Preserve specific numbers, dates, names, and technical details
- Maintain cause-effect relationships
- Keep task outcomes and their reasoning
- Note any unresolved issues or pending items

## Output Format:
Provide a structured summary with these sections:
1. **Key Facts** - Important information learned
2. **Decisions Made** - What was decided and why
3. **Action Items** - Pending or completed actions
4. **Context Notes** - Background needed for future reference
5. **Unresolved** - Any open questions or issues

Keep the summary concise but comprehensive. Aim for 80%+ compression ratio.`;

// All agent roles for compression
const ALL_AGENT_ROLES = [
  'ceo', 'cfo', 'cto', 'coo', 'cos', 'cmo', 'cpo',
  'ciso', 'clo', 'chro', 'devops', 'qa', 'swe', 'data'
];

class MemoryCompressionService {
  constructor(config = {}) {
    // Initialize LLM router
    this.llm = config.llmRouter || new LLMRouter();

    // Initialize Supabase client
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('[MEMORY-COMPRESSION] Supabase client initialized');
    } else {
      this.supabase = null;
      console.warn('[MEMORY-COMPRESSION] Supabase not configured - compression disabled');
    }

    // Compression settings
    this.defaultOlderThanHours = config.olderThanHours || 24;
    this.minConversationsToCompress = config.minConversations || 3;
    this.maxTokensPerCompression = config.maxTokensPerCompression || 50000;
    this.targetCompressionRatio = config.targetCompressionRatio || 0.2; // 80% reduction

    console.log('[MEMORY-COMPRESSION] Memory Compression Service initialized');
  }

  /**
   * Compress old conversations for a specific agent
   * @param {string} agentRole - The agent role to compress conversations for
   * @param {Object} options - Compression options
   * @returns {Object} Compression result
   */
  async compressAgentMemory(agentRole, options = {}) {
    const {
      olderThanHours = this.defaultOlderThanHours,
      compressionLevel = 1,
      dryRun = false,
    } = options;

    console.log(`[MEMORY-COMPRESSION] Starting compression for ${agentRole} (older than ${olderThanHours}h)`);

    if (!this.supabase) {
      return {
        success: false,
        error: 'Database not configured',
        agentRole,
      };
    }

    try {
      // 1. Calculate cutoff time
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      // 2. Get old, uncompressed conversations
      const { data: conversations, error: fetchError } = await this.supabase
        .from('monolith_agent_conversations')
        .select('*')
        .eq('agent_role', agentRole)
        .eq('is_compressed', false)
        .lt('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw new Error(`Failed to fetch conversations: ${fetchError.message}`);
      }

      if (!conversations || conversations.length < this.minConversationsToCompress) {
        console.log(`[MEMORY-COMPRESSION] Not enough conversations for ${agentRole}: ${conversations?.length || 0}`);
        return {
          success: true,
          agentRole,
          conversationsFound: conversations?.length || 0,
          compressed: false,
          reason: `Need at least ${this.minConversationsToCompress} conversations`,
        };
      }

      // 3. Calculate total tokens
      const totalTokens = conversations.reduce((sum, c) => sum + (c.token_count || 0), 0);

      // 4. If dry run, just return stats
      if (dryRun) {
        return {
          success: true,
          agentRole,
          dryRun: true,
          conversationsFound: conversations.length,
          totalTokens,
          estimatedCompressedTokens: Math.round(totalTokens * this.targetCompressionRatio),
          oldestConversation: conversations[0]?.created_at,
          newestConversation: conversations[conversations.length - 1]?.created_at,
        };
      }

      // 5. Build conversation text for compression
      const conversationText = this.buildConversationText(conversations);

      // 6. Use LLM to summarize
      const summary = await this.compressWithLLM(conversationText, agentRole);

      // 7. Save compression record
      const compressionRecord = await this.saveCompressionRecord({
        agentRole,
        compressionType: 'conversation',
        originalTokenCount: totalTokens,
        compressedContent: summary.content,
        compressedTokenCount: summary.tokens,
        sourceIds: conversations.map(c => c.conversation_id),
        compressionRatio: totalTokens > 0 ? summary.tokens / totalTokens : 1,
      });

      // 8. Mark originals as compressed
      await this.markConversationsCompressed(conversations.map(c => c.conversation_id));

      console.log(`[MEMORY-COMPRESSION] Compressed ${conversations.length} conversations for ${agentRole}: ${totalTokens} -> ${summary.tokens} tokens`);

      return {
        success: true,
        agentRole,
        conversationsCompressed: conversations.length,
        originalTokenCount: totalTokens,
        compressedTokenCount: summary.tokens,
        compressionRatio: totalTokens > 0 ? Math.round((summary.tokens / totalTokens) * 100) / 100 : 1,
        savedTokens: totalTokens - summary.tokens,
        compressionRecordId: compressionRecord?.id,
      };
    } catch (error) {
      console.error(`[MEMORY-COMPRESSION] Error compressing ${agentRole}:`, error.message);
      return {
        success: false,
        error: error.message,
        agentRole,
      };
    }
  }

  /**
   * Build conversation text from conversation records
   */
  buildConversationText(conversations) {
    let text = '';

    for (const conv of conversations) {
      const timestamp = new Date(conv.created_at).toLocaleString();
      text += `\n--- Conversation ${conv.conversation_id} (${timestamp}) ---\n`;

      if (conv.messages && Array.isArray(conv.messages)) {
        for (const msg of conv.messages) {
          text += `[${msg.role?.toUpperCase() || 'UNKNOWN'}]: ${msg.content}\n`;
        }
      } else if (typeof conv.messages === 'string') {
        text += conv.messages;
      }

      text += '\n';
    }

    return text;
  }

  /**
   * Use LLM to compress conversations
   */
  async compressWithLLM(conversationText, agentRole) {
    const compressPrompt = `Compress the following ${agentRole.toUpperCase()} agent conversations into a concise summary.

## Conversations to Compress:
${conversationText}

## Instructions:
- Preserve all key facts, decisions, and action items
- Remove redundant information
- Maintain context needed for future tasks
- Aim for 80%+ compression while keeping essential information`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: COMPRESSION_SYSTEM_PROMPT,
      userMessage: compressPrompt,
      temperature: 0.3, // Lower temperature for consistent compression
    });

    // Estimate token count (rough approximation: 4 chars per token)
    const estimatedTokens = Math.ceil(response.content.length / 4);

    return {
      content: response.content,
      tokens: response.usage?.total_tokens || estimatedTokens,
    };
  }

  /**
   * Save compression record to database
   */
  async saveCompressionRecord(record) {
    if (!this.supabase) {
      console.log('[MEMORY-COMPRESSION] Compression record (no DB):', record);
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('monolith_memory_compressions')
        .insert([{
          agent_role: record.agentRole,
          compression_type: record.compressionType,
          original_token_count: record.originalTokenCount,
          compressed_token_count: record.compressedTokenCount,
          compressed_content: record.compressedContent,
          source_ids: record.sourceIds,
          compression_ratio: record.compressionRatio,
        }])
        .select()
        .single();

      if (error) {
        console.error('[MEMORY-COMPRESSION] Failed to save compression record:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[MEMORY-COMPRESSION] Database error:', error.message);
      return null;
    }
  }

  /**
   * Mark conversations as compressed
   */
  async markConversationsCompressed(conversationIds) {
    if (!this.supabase || !conversationIds.length) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('monolith_agent_conversations')
        .update({ is_compressed: true })
        .in('conversation_id', conversationIds);

      if (error) {
        console.error('[MEMORY-COMPRESSION] Failed to mark conversations:', error.message);
      }
    } catch (error) {
      console.error('[MEMORY-COMPRESSION] Database error:', error.message);
    }
  }

  /**
   * Run daily compression for all agents
   * @param {Object} options - Compression options
   * @returns {Object} Summary of all compressions
   */
  async runDailyCompression(options = {}) {
    const agents = options.agents || ALL_AGENT_ROLES;
    const results = {
      timestamp: new Date().toISOString(),
      agents: [],
      totalConversationsCompressed: 0,
      totalTokensSaved: 0,
      errors: [],
    };

    console.log(`[MEMORY-COMPRESSION] Starting daily compression for ${agents.length} agents`);

    for (const agentRole of agents) {
      const result = await this.compressAgentMemory(agentRole, options);

      results.agents.push({
        role: agentRole,
        success: result.success,
        conversationsCompressed: result.conversationsCompressed || 0,
        tokensSaved: result.savedTokens || 0,
        error: result.error,
      });

      if (result.success && result.conversationsCompressed) {
        results.totalConversationsCompressed += result.conversationsCompressed;
        results.totalTokensSaved += result.savedTokens;
      } else if (!result.success) {
        results.errors.push({
          agent: agentRole,
          error: result.error,
        });
      }
    }

    console.log(`[MEMORY-COMPRESSION] Daily compression complete:`, {
      agents: agents.length,
      conversationsCompressed: results.totalConversationsCompressed,
      tokensSaved: results.totalTokensSaved,
      errors: results.errors.length,
    });

    return results;
  }

  /**
   * Get compression statistics
   * @param {Object} options - Query options
   * @returns {Object} Compression statistics
   */
  async getCompressionStats(options = {}) {
    if (!this.supabase) {
      return null;
    }

    const { agentRole, days = 30 } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      let query = this.supabase
        .from('monolith_memory_compressions')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (agentRole) {
        query = query.eq('agent_role', agentRole);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          totalCompressions: 0,
          totalOriginalTokens: 0,
          totalCompressedTokens: 0,
          avgCompressionRatio: null,
          tokensSaved: 0,
        };
      }

      const totalOriginal = data.reduce((sum, c) => sum + (c.original_token_count || 0), 0);
      const totalCompressed = data.reduce((sum, c) => sum + (c.compressed_token_count || 0), 0);
      const avgRatio = data.reduce((sum, c) => sum + (c.compression_ratio || 0), 0) / data.length;

      return {
        totalCompressions: data.length,
        totalOriginalTokens: totalOriginal,
        totalCompressedTokens: totalCompressed,
        avgCompressionRatio: Math.round(avgRatio * 100) / 100,
        tokensSaved: totalOriginal - totalCompressed,
        byAgent: this.groupStatsByAgent(data),
      };
    } catch (error) {
      console.error('[MEMORY-COMPRESSION] Failed to get stats:', error.message);
      return null;
    }
  }

  /**
   * Group compression stats by agent
   */
  groupStatsByAgent(compressions) {
    const byAgent = {};

    for (const c of compressions) {
      if (!byAgent[c.agent_role]) {
        byAgent[c.agent_role] = {
          compressions: 0,
          originalTokens: 0,
          compressedTokens: 0,
        };
      }

      byAgent[c.agent_role].compressions++;
      byAgent[c.agent_role].originalTokens += c.original_token_count || 0;
      byAgent[c.agent_role].compressedTokens += c.compressed_token_count || 0;
    }

    return byAgent;
  }

  /**
   * Get agent memory status (for UI display)
   * @param {string} agentRole - The agent role
   * @returns {Object} Memory status
   */
  async getAgentMemoryStatus(agentRole) {
    if (!this.supabase) {
      return null;
    }

    try {
      // Get conversation counts
      const { data: conversations, error: convError } = await this.supabase
        .from('monolith_agent_conversations')
        .select('conversation_id, token_count, is_compressed, created_at')
        .eq('agent_role', agentRole);

      if (convError) throw convError;

      const uncompressed = conversations?.filter(c => !c.is_compressed) || [];
      const compressed = conversations?.filter(c => c.is_compressed) || [];

      const uncompressedTokens = uncompressed.reduce((sum, c) => sum + (c.token_count || 0), 0);
      const totalKnowledge = await this.getKnowledgeCount(agentRole);

      // Check if compression is recommended
      const needsCompression = uncompressed.length >= this.minConversationsToCompress;

      return {
        agentRole,
        totalConversations: conversations?.length || 0,
        uncompressedConversations: uncompressed.length,
        compressedConversations: compressed.length,
        uncompressedTokens,
        knowledgeEntries: totalKnowledge,
        needsCompression,
        lastConversation: uncompressed.length > 0
          ? uncompressed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at
          : null,
      };
    } catch (error) {
      console.error('[MEMORY-COMPRESSION] Failed to get memory status:', error.message);
      return null;
    }
  }

  /**
   * Get knowledge entry count for an agent
   */
  async getKnowledgeCount(agentRole) {
    if (!this.supabase) return 0;

    try {
      const { count, error } = await this.supabase
        .from('monolith_agent_knowledge')
        .select('*', { count: 'exact', head: true })
        .eq('agent_role', agentRole);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }
}

export default MemoryCompressionService;
export { COMPRESSION_SYSTEM_PROMPT, ALL_AGENT_ROLES };
