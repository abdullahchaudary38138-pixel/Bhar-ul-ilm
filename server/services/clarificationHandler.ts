import type { UnderstandingAnalysis } from '../../src/types.ts';

export const clarificationHandlerService = {
  buildClarificationResponse(analysis: UnderstandingAnalysis): string {
    if (analysis.clarificationQuestion && analysis.clarificationQuestion.trim().length > 0) {
      return analysis.clarificationQuestion.trim();
    }
    const missing = analysis.missingDetails[0] || analysis.ambiguities[0] || 'مکمل تفصیل';
    return `براہِ کرم ${missing} کی وضاحت فرما دیں تاکہ میں اندازہ لگانے کے بجائے مستند کتابوں اور حوالہ جات کی روشنی میں درست جواب دے سکوں۔`;
  },

  buildConfirmationResponse(analysis: UnderstandingAnalysis): string {
    if (analysis.confirmationPrompt && analysis.confirmationPrompt.trim().length > 0) {
      return analysis.confirmationPrompt.trim();
    }
    return `میں آپ کا سوال اس طرح سمجھ رہا ہوں: آپ "${analysis.subject}" پر مستند اسلامی کتابوں اور قرآن و حدیث کی روشنی میں تفصیلی تحقیق چاہتے ہیں۔ کیا میرا سمجھنا درست ہے؟`;
  },
};
