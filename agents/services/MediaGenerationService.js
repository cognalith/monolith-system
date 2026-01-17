/**
 * MONOLITH OS - Media Generation Service
 * Unified interface for generating various media types
 *
 * Supported Media Types:
 * - Infographics (via Canva MCP)
 * - Slide Decks / Presentations (via Canva MCP)
 * - Videos (via Canva MCP)
 * - Podcasts / Audio (via NotebookLM)
 *
 * Used by: Aria (personal), Mona (CMO)
 */

import notebookLMService from './NotebookLMService.js';

// Supported media types and their backends
const MEDIA_TYPES = {
  infographic: {
    backend: 'canva',
    canvaDesignType: 'infographic',
    description: 'Visual data representation',
    exportFormats: ['png', 'pdf', 'jpg'],
  },
  slides: {
    backend: 'canva',
    canvaDesignType: 'presentation',
    description: 'Presentation deck',
    exportFormats: ['pptx', 'pdf', 'png'],
  },
  video: {
    backend: 'canva',
    canvaDesignType: 'your_story', // or video format
    description: 'Video content',
    exportFormats: ['mp4', 'gif'],
  },
  social: {
    backend: 'canva',
    canvaDesignType: 'instagram_post',
    description: 'Social media graphic',
    exportFormats: ['png', 'jpg'],
  },
  podcast: {
    backend: 'notebooklm',
    description: 'Audio overview / Deep Dive podcast',
    exportFormats: ['mp3', 'share_link'],
  },
  poster: {
    backend: 'canva',
    canvaDesignType: 'poster',
    description: 'Large format poster',
    exportFormats: ['png', 'pdf'],
  },
  flyer: {
    backend: 'canva',
    canvaDesignType: 'flyer',
    description: 'Promotional flyer',
    exportFormats: ['png', 'pdf'],
  },
  logo: {
    backend: 'canva',
    canvaDesignType: 'logo',
    description: 'Brand logo',
    exportFormats: ['png', 'svg'],
  },
};

class MediaGenerationService {
  constructor(options = {}) {
    this.notebookLMService = options.notebookLMService || notebookLMService;
    this.defaultBrandKitId = options.defaultBrandKitId || null;
    this.outputDirectory = options.outputDirectory || './media-output';
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) {
      return { success: true, message: 'Service already initialized' };
    }

    this.initialized = true;

    return {
      success: true,
      message: 'MediaGenerationService initialized',
      supportedTypes: Object.keys(MEDIA_TYPES),
    };
  }

  /**
   * Get information about supported media types
   */
  getSupportedTypes() {
    return {
      success: true,
      types: Object.entries(MEDIA_TYPES).map(([key, value]) => ({
        type: key,
        backend: value.backend,
        description: value.description,
        exportFormats: value.exportFormats,
      })),
    };
  }

  /**
   * Main unified method to create any media type
   */
  async createMedia(type, content, options = {}) {
    const mediaConfig = MEDIA_TYPES[type];

    if (!mediaConfig) {
      return {
        success: false,
        error: `Unsupported media type: ${type}`,
        supportedTypes: Object.keys(MEDIA_TYPES),
      };
    }

    if (mediaConfig.backend === 'canva') {
      return this.createCanvaMedia(type, content, options);
    } else if (mediaConfig.backend === 'notebooklm') {
      return this.createPodcast(content, options);
    }

    return {
      success: false,
      error: `Unknown backend: ${mediaConfig.backend}`,
    };
  }

  /**
   * Create Canva-based media
   * Returns instructions for Canva MCP tools (called via Claude Code)
   */
  async createCanvaMedia(type, content, options = {}) {
    const mediaConfig = MEDIA_TYPES[type];

    if (!mediaConfig || mediaConfig.backend !== 'canva') {
      return {
        success: false,
        error: `${type} is not a Canva media type`,
      };
    }

    const brandKitId = options.brandKitId || this.defaultBrandKitId;

    // Build the design request
    const designRequest = {
      type: 'canva_design_request',
      mediaType: type,
      action: 'generate-design',
      params: {
        query: content,
        design_type: mediaConfig.canvaDesignType,
        user_intent: `Generate ${type} for: ${content.substring(0, 100)}...`,
      },
    };

    if (brandKitId) {
      designRequest.params.brand_kit_id = brandKitId;
    }

    // If assets are provided, include them
    if (options.assetIds && options.assetIds.length > 0) {
      designRequest.params.asset_ids = options.assetIds;
    }

    return {
      success: true,
      status: 'ready',
      message: `Canva ${type} request prepared. Use Canva MCP generate-design tool.`,
      request: designRequest,
      exportFormats: mediaConfig.exportFormats,
      instructions: this._getCanvaInstructions(type, designRequest),
    };
  }

  /**
   * Create infographic
   */
  async createInfographic(content, options = {}) {
    return this.createMedia('infographic', content, options);
  }

  /**
   * Create presentation/slides
   */
  async createSlides(content, options = {}) {
    // For presentations, enhance the content with slide structure
    const enhancedContent = options.slideStructure
      ? this._formatPresentationBrief(content, options.slideStructure)
      : content;

    return this.createMedia('slides', enhancedContent, options);
  }

  /**
   * Create video
   */
  async createVideo(content, options = {}) {
    return this.createMedia('video', content, options);
  }

  /**
   * Create social media graphic
   */
  async createSocialGraphic(content, options = {}) {
    // Allow specifying platform
    const platform = options.platform || 'instagram';
    const platformTypes = {
      instagram: 'instagram_post',
      facebook: 'facebook_post',
      twitter: 'twitter_post',
      pinterest: 'pinterest_pin',
      youtube: 'youtube_thumbnail',
    };

    const designType = platformTypes[platform] || 'instagram_post';

    return this.createCanvaMedia('social', content, {
      ...options,
      canvaDesignType: designType,
    });
  }

  /**
   * Create podcast via NotebookLM
   */
  async createPodcast(content, options = {}) {
    try {
      const title = options.title || 'Generated Podcast';
      const sources = [];

      // Handle different source formats
      if (options.sources && Array.isArray(options.sources)) {
        sources.push(...options.sources);
      }

      // Add main content as a text source
      if (content && typeof content === 'string' && content.length > 0) {
        sources.push({
          type: 'text',
          content: content,
          title: 'Main Content',
        });
      }

      if (sources.length === 0) {
        return {
          success: false,
          error: 'No sources provided for podcast generation',
        };
      }

      // Use NotebookLM service
      const result = await this.notebookLMService.createPodcast(title, sources, {
        timeout: options.timeout || 600000,
      });

      if (result.success) {
        return {
          success: true,
          status: 'completed',
          mediaType: 'podcast',
          backend: 'notebooklm',
          title,
          notebookId: result.notebookId,
          notebookUrl: result.notebookUrl,
          shareLink: result.shareLink,
          generationTimeSeconds: result.generationTimeSeconds,
          message: `Podcast "${title}" generated successfully`,
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Podcast creation failed: ${error.message}`,
      };
    }
  }

  /**
   * Batch create multiple media types for a product
   */
  async batchCreateProductKit(product, options = {}) {
    const brandKitId = options.brandKitId || this.defaultBrandKitId;
    const types = options.types || ['infographic', 'slides', 'video', 'podcast'];

    const results = {
      product: product.name || 'Unnamed Product',
      brandKitId,
      media: {},
      summary: {
        requested: types.length,
        successful: 0,
        failed: 0,
      },
    };

    for (const type of types) {
      try {
        const content = this._formatProductContent(product, type);

        const result = await this.createMedia(type, content, {
          brandKitId,
          title: `${product.name} - ${type}`,
          sources: type === 'podcast' ? product.documentUrls : undefined,
        });

        results.media[type] = result;

        if (result.success) {
          results.summary.successful++;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        results.media[type] = {
          success: false,
          error: error.message,
        };
        results.summary.failed++;
      }
    }

    return {
      success: results.summary.failed === 0,
      ...results,
    };
  }

  /**
   * Get Canva MCP tool instructions
   */
  _getCanvaInstructions(type, request) {
    return {
      step1: {
        tool: 'mcp__canva__generate-design',
        params: request.params,
        description: `Generate ${type} design`,
      },
      step2: {
        tool: 'mcp__canva__create-design-from-candidate',
        params: { job_id: '<from step1>', candidate_id: '<user selected>' },
        description: 'Create editable design from selected candidate',
      },
      step3: {
        tool: 'mcp__canva__export-design',
        params: {
          design_id: '<from step2>',
          format: { type: request.exportFormats?.[0] || 'png' },
        },
        description: 'Export final design',
      },
    };
  }

  /**
   * Format product content for specific media type
   */
  _formatProductContent(product, type) {
    const name = product.name || 'Product';
    const brief = product.brief || product.description || '';
    const features = product.features || [];
    const benefits = product.benefits || [];

    switch (type) {
      case 'infographic':
        return `Create an infographic for ${name}.\n\n` +
               `Description: ${brief}\n\n` +
               (features.length > 0 ? `Key Features:\n${features.map(f => `- ${f}`).join('\n')}\n\n` : '') +
               (benefits.length > 0 ? `Benefits:\n${benefits.map(b => `- ${b}`).join('\n')}` : '');

      case 'slides':
        return `Create a presentation about ${name}.\n\n` +
               `**Presentation Brief**\n` +
               `Title: ${name}\n` +
               `Topic: ${brief}\n\n` +
               `**Key Messages:**\n` +
               features.slice(0, 5).map((f, i) => `${i + 1}. ${f}`).join('\n');

      case 'video':
        return `Create a short promotional video for ${name}.\n\n` +
               `Message: ${brief}\n` +
               `Style: Professional, engaging`;

      case 'social':
        return `Create a social media post for ${name}.\n\n` +
               `Hook: ${brief.substring(0, 100)}`;

      case 'podcast':
        return `${name}\n\n${brief}\n\n` +
               (features.length > 0 ? `Features:\n${features.join('\n')}\n\n` : '') +
               (benefits.length > 0 ? `Benefits:\n${benefits.join('\n')}` : '');

      default:
        return `${name}: ${brief}`;
    }
  }

  /**
   * Format presentation brief for Canva
   */
  _formatPresentationBrief(content, slideStructure) {
    let brief = content + '\n\n**Slide Plan:**\n';

    if (Array.isArray(slideStructure)) {
      slideStructure.forEach((slide, index) => {
        brief += `\nSlide ${index + 1} - "${slide.title}"\n`;
        brief += `Goal: ${slide.goal || 'N/A'}\n`;
        if (slide.bullets) {
          brief += `Bullets:\n${slide.bullets.map(b => `- ${b}`).join('\n')}\n`;
        }
      });
    }

    return brief;
  }

  /**
   * Close service and cleanup resources
   */
  async close() {
    try {
      if (this.notebookLMService) {
        await this.notebookLMService.close();
      }

      this.initialized = false;

      return {
        success: true,
        message: 'MediaGenerationService closed',
      };
    } catch (error) {
      return {
        success: false,
        error: `Close failed: ${error.message}`,
      };
    }
  }
}

// Singleton instance
const mediaGenerationService = new MediaGenerationService();

export default mediaGenerationService;
export { MediaGenerationService, MEDIA_TYPES };
