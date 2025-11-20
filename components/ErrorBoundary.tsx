'use client';

import React, { Component, ReactNode } from 'react';
import { reportErrorToBoundary } from '@/lib/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React 에러 바운더리 - 컴포넌트 렌더링 에러 포착
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportErrorToBoundary(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 fallback이 제공된 경우
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2 text-gray-900">
              문제가 발생했습니다
            </h1>
            
            <p className="text-gray-600 text-center mb-6">
              페이지를 표시하는 중 오류가 발생했습니다.
            </p>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <div className="mb-6 p-4 bg-gray-100 rounded-lg overflow-auto">
                <p className="text-sm font-mono text-red-600 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                다시 시도
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                홈으로 돌아가기
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-6">
              문제가 계속되면 관리자에게 문의하세요.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 특정 섹션용 작은 에러 바운더리
 */
export function SectionErrorBoundary({ 
  children,
  sectionName 
}: { 
  children: ReactNode;
  sectionName?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium mb-2">
            {sectionName ? `${sectionName} ` : ''}섹션 로드 실패
          </p>
          <p className="text-sm text-gray-600">
            페이지를 새로고침하거나 나중에 다시 시도해주세요.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}


