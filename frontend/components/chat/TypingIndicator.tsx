// 메시지 말풍선과 동일한 max-w-3xl mx-auto 컨테이너 + px-4로 가로 정렬 일치
export function TypingIndicator() {
  return (
    <div className="w-full px-8 mt-2">
      <div className="flex justify-start">
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex gap-1 items-center h-4">
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "1s" }}
            />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "150ms", animationDuration: "1s" }}
            />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "300ms", animationDuration: "1s" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
