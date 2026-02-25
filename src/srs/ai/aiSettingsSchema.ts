/**
 * AI 设置 Schema 模块
 * 
 * 定义 AI 功能的设置项和获取设置的工具函数
 */

/**
 * AI 设置 Schema 定义
 * 用于 Orca 插件设置界面
 * 
 * 注意：使用命令面板搜索 "SRS: 测试 AI 连接" 来测试连接
 */
export const aiSettingsSchema = {
  "ai.apiKey": {
    label: "API Key",
    type: "string" as const,
    defaultValue: "",
    description: "OpenAI 兼容的 API Key（请妥善保管，不要泄露）"
  },
  "ai.apiUrl": {
    label: "API URL",
    type: "string" as const,
    defaultValue: "https://api.openai.com/v1/chat/completions",
    description: "API 端点地址，支持 OpenAI 兼容的第三方服务（如 DeepSeek、Ollama 等）"
  },
  "ai.model": {
    label: "AI Model",
    type: "string" as const,
    defaultValue: "gpt-3.5-turbo",
    description: "使用的模型名称（如 gpt-4、deepseek-chat、llama2 等）"
  },
  "ai.language": {
    label: "生成语言",
    type: "string" as const,
    defaultValue: "中文",
    description: "AI 生成内容的语言"
  },
  "ai.difficulty": {
    label: "难度级别",
    type: "string" as const,
    defaultValue: "普通",
    description: "生成卡片的难度级别（简单/普通/困难）"
  },
  "ai.promptTemplate": {
    label: "提示词模板",
    type: "string" as const,
    defaultValue: `你是一个闪卡制作助手。根据用户提供的内容，生成一个问答对。

输入内容：{{content}}
语言要求：{{language}}
难度级别：{{difficulty}}

要求：
1. 根据内容生成一个问题和对应的答案
2. 问题应该清晰简洁，符合指定的难度级别
3. 答案应该准确但简短
4. 使用指定的语言输出

请严格以 JSON 格式返回，不要包含其他内容：
{"question": "问题内容", "answer": "答案内容"}`,
    description: "AI 生成卡片的提示词模板。支持变量：{{content}}（用户输入）、{{language}}（语言）、{{difficulty}}（难度）。使用命令面板搜索「SRS: 测试 AI 连接」来验证配置。"
  }
}



/**
 * AI 设置接口
 */
export interface AISettings {
  apiKey: string
  apiUrl: string
  model: string
  language: string
  difficulty: string
  promptTemplate: string
}

/**
 * 获取 AI 设置
 * 
 * @param pluginName - 插件名称
 * @returns AI 设置对象
 */
export function getAISettings(pluginName: string): AISettings {
  const settings = orca.state.plugins[pluginName]?.settings
  return {
    apiKey: settings?.["ai.apiKey"] || "",
    apiUrl: settings?.["ai.apiUrl"] || "https://api.openai.com/v1/chat/completions",
    model: settings?.["ai.model"] || "gpt-3.5-turbo",
    language: settings?.["ai.language"] || "中文",
    difficulty: settings?.["ai.difficulty"] || "普通",
    promptTemplate: settings?.["ai.promptTemplate"] || aiSettingsSchema["ai.promptTemplate"].defaultValue
  }
}

/**
 * 检查 AI 是否已配置
 * 
 * @param pluginName - 插件名称
 * @returns 是否已配置 API Key
 */
export function isAIConfigured(pluginName: string): boolean {
  const settings = getAISettings(pluginName)
  return !!settings.apiKey
}
