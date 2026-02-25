/**
 * AI 服务模块
 * 
 * 封装 OpenAI 兼容 API 的调用逻辑
 */

import { getAISettings, AISettings } from "./aiSettingsSchema"

/**
 * AI 生成的卡片结果
 */
export interface AICardResult {
  question: string
  answer: string
}

/**
 * AI 服务错误
 */
export interface AIServiceError {
  code: string
  message: string
}

/**
 * AI 生成结果类型
 */
export type AIGenerateResult = 
  | { success: true; data: AICardResult }
  | { success: false; error: AIServiceError }

/**
 * 构建完整的提示词
 * 
 * 替换模板中的变量占位符
 * 
 * @param template - 提示词模板
 * @param content - 用户输入的内容
 * @param settings - AI 设置
 * @returns 完整的提示词
 */
function buildPrompt(template: string, content: string, settings: AISettings): string {
  return template
    .replace(/\{\{content\}\}/g, content)
    .replace(/\{\{language\}\}/g, settings.language)
    .replace(/\{\{difficulty\}\}/g, settings.difficulty)
}

/**
 * 解析 AI 响应内容
 * 
 * 尝试从 AI 响应中提取 JSON 格式的问答对
 * 
 * @param content - AI 响应的原始内容
 * @returns 解析后的卡片结果或错误
 */
function parseAIResponse(content: string): AIGenerateResult {
  try {
    // 尝试直接解析 JSON
    const parsed = JSON.parse(content)
    if (parsed.question && parsed.answer) {
      return {
        success: true,
        data: {
          question: String(parsed.question).trim(),
          answer: String(parsed.answer).trim()
        }
      }
    }
  } catch {
    // 尝试从文本中提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*"question"[\s\S]*"answer"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.question && parsed.answer) {
          return {
            success: true,
            data: {
              question: String(parsed.question).trim(),
              answer: String(parsed.answer).trim()
            }
          }
        }
      } catch {
        // 继续到错误处理
      }
    }
  }
  
  return {
    success: false,
    error: {
      code: "PARSE_ERROR",
      message: "无法解析 AI 响应格式，请检查提示词模板"
    }
  }
}

/**
 * 调用 OpenAI 兼容的 API 生成问答卡片
 * 
 * @param pluginName - 插件名称
 * @param content - 用户输入的内容
 * @returns 生成结果
 */
export async function generateCardFromAI(
  pluginName: string,
  content: string
): Promise<AIGenerateResult> {
  const settings = getAISettings(pluginName)
  
  if (!settings.apiKey) {
    return { 
      success: false, 
      error: { code: "NO_API_KEY", message: "请先在设置中配置 API Key" } 
    }
  }
  
  // 构建提示词
  const prompt = buildPrompt(settings.promptTemplate, content, settings)
  
  console.log(`[AI Service] 调用 AI 生成卡片`)
  console.log(`[AI Service] API URL: ${settings.apiUrl}`)
  console.log(`[AI Service] Model: ${settings.model}`)
  console.log(`[AI Service] 提示词长度: ${prompt.length}`)
  
  try {
    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { 
            role: "system", 
            content: "你是一个闪卡制作助手。你的任务是根据用户输入生成问答卡片。请严格以 JSON 格式返回结果。" 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })
    
    if (!response.ok) {
      let errorMessage = `请求失败: ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.error?.message || errorMessage
      } catch {
        // 使用默认错误信息
      }
      
      console.error(`[AI Service] API 错误: ${errorMessage}`)
      
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorMessage
        }
      }
    }
    
    const data = await response.json()
    const aiContent = data.choices?.[0]?.message?.content
    
    if (!aiContent) {
      console.error(`[AI Service] AI 返回内容为空`)
      return {
        success: false,
        error: { code: "EMPTY_RESPONSE", message: "AI 返回内容为空" }
      }
    }
    
    console.log(`[AI Service] AI 响应: ${aiContent}`)
    
    // 解析响应
    return parseAIResponse(aiContent)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "网络错误"
    console.error(`[AI Service] 网络错误: ${errorMessage}`)
    
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: errorMessage
      }
    }
  }
}

/**
 * 测试 AI 连接
 * 
 * 发送一个简单的请求来验证 API 配置是否正确
 * 
 * @param pluginName - 插件名称
 * @returns 测试结果
 */
export async function testAIConnection(
  pluginName: string
): Promise<{ success: boolean; message: string }> {
  const settings = getAISettings(pluginName)
  
  if (!settings.apiKey) {
    return { success: false, message: "请先配置 API Key" }
  }
  
  console.log(`[AI Service] 测试连接 - URL: ${settings.apiUrl}, Model: ${settings.model}`)
  
  try {
    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      const modelUsed = data.model || settings.model
      console.log(`[AI Service] 连接成功 - 使用模型: ${modelUsed}`)
      return { success: true, message: `连接成功！使用模型: ${modelUsed}` }
    } else {
      let errorMessage = `连接失败: ${response.status}`
      try {
        const error = await response.json()
        errorMessage = error.error?.message || errorMessage
      } catch {
        // 使用默认错误信息
      }
      console.error(`[AI Service] 连接失败: ${errorMessage}`)
      return { success: false, message: errorMessage }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "网络错误"
    console.error(`[AI Service] 连接错误: ${errorMessage}`)
    return { success: false, message: errorMessage }
  }
}
