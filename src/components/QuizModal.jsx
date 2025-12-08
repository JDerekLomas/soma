import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Loader2, Trophy, Target } from 'lucide-react';

/**
 * QuizModal - Displays MCQ questions and tracks answers
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - question: { question: string, options: string[], correct_answer: string } | null
 * - objective: string - The concept being quizzed
 * - onAnswer: (selectedAnswer: string, correctAnswer: string) => Promise<{correct: boolean, mastery: number}>
 * - isLoading: boolean
 */
export default function QuizModal({
  isOpen,
  onClose,
  question,
  objective,
  onAnswer,
  isLoading
}) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null); // { correct: boolean, mastery: number }
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectAnswer = async (answer) => {
    if (result || isSubmitting) return; // Already answered

    setSelectedAnswer(answer);
    setIsSubmitting(true);

    try {
      const answerResult = await onAnswer(answer, question.correct_answer);
      setResult(answerResult);
    } catch (error) {
      console.error('Error recording answer:', error);
      // Still show correct/incorrect locally
      setResult({
        correct: answer === question.correct_answer,
        mastery: null
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedAnswer(null);
    setResult(null);
    onClose();
  };

  const getOptionStyle = (option) => {
    if (!result) {
      // Not yet answered
      return selectedAnswer === option
        ? 'border-[#D97757] bg-orange-50'
        : 'border-[#E6E4DD] hover:border-[#D97757] hover:bg-orange-50/50';
    }

    // After answer
    if (option === question.correct_answer) {
      return 'border-green-500 bg-green-50';
    }
    if (option === selectedAnswer && !result.correct) {
      return 'border-red-500 bg-red-50';
    }
    return 'border-[#E6E4DD] opacity-50';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#E6E4DD] bg-[#FAF9F6] flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#D97757]">
            <Target size={18} />
            <span className="text-sm font-medium">Knowledge Check</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-[#EFECE6] rounded-lg transition-colors"
          >
            <X size={18} className="text-[#6B6B6B]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-8 h-8 text-[#D97757] animate-spin mb-4" />
              <p className="text-sm text-[#6B6B6B]">Generating question about {objective}...</p>
            </div>
          ) : question ? (
            <>
              {/* Objective badge */}
              <div className="mb-4">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#F2F0EB] rounded-full text-xs text-[#6B6B6B]">
                  <Target size={12} />
                  {objective}
                </span>
              </div>

              {/* Question */}
              <h3 className="text-lg font-serif text-[#141413] mb-6 leading-relaxed">
                {question.question}
              </h3>

              {/* Options */}
              <div className="space-y-3">
                {question.options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectAnswer(option)}
                    disabled={!!result || isSubmitting}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${getOptionStyle(option)}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#F2F0EB] flex items-center justify-center text-sm font-medium text-[#6B6B6B]">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 text-[#2D2D2A]">{option}</span>
                      {result && option === question.correct_answer && (
                        <CheckCircle size={20} className="text-green-500" />
                      )}
                      {result && option === selectedAnswer && !result.correct && (
                        <XCircle size={20} className="text-red-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Result feedback */}
              {result && (
                <div className={`mt-6 p-4 rounded-xl ${result.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-3">
                    {result.correct ? (
                      <>
                        <CheckCircle size={24} className="text-green-500" />
                        <div>
                          <p className="font-medium text-green-800">Correct!</p>
                          {result.mastery !== null && (
                            <p className="text-sm text-green-600">
                              Mastery: {Math.round(result.mastery * 100)}%
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle size={24} className="text-red-500" />
                        <div>
                          <p className="font-medium text-red-800">Not quite</p>
                          <p className="text-sm text-red-600">
                            The correct answer was: {question.correct_answer}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-[#6B6B6B]">
              No question available
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="p-4 border-t border-[#E6E4DD] bg-[#FAF9F6] flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-[#6B6B6B] hover:bg-[#EFECE6] rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setSelectedAnswer(null);
                setResult(null);
                // Parent will need to generate a new question
                onClose('another');
              }}
              className="px-4 py-2 text-sm font-medium bg-[#D97757] text-white rounded-lg hover:bg-[#C06345] transition-colors flex items-center gap-2"
            >
              <Trophy size={16} />
              Another Question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
