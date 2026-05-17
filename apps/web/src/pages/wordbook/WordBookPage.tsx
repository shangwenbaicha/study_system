import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { wordbookApi, type WordBookDTO, type WordDTO, type StudyStatsDTO } from "../../api/new-client";
import { BookOpen, Plus, Trash2, BarChart3, CheckCircle, Clock, Award, Calendar, Download, X, Volume2, ChevronDown, ChevronUp } from "lucide-react";
import { useSpeech } from "../../hooks/use-speech";

export default function WordBookPage() {
  const { t } = useTranslation();
  const { speak } = useSpeech();
  const [wordbooks, setWordbooks] = useState<WordBookDTO[]>([]);
  const [builtInBooks, setBuiltInBooks] = useState<WordBookDTO[]>([]);
  const [selectedBook, setSelectedBook] = useState<WordBookDTO | null>(null);
  const [words, setWords] = useState<WordDTO[]>([]);
  const [stats, setStats] = useState<StudyStatsDTO | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [newBookLang, setNewBookLang] = useState("japanese");
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [tab, setTab] = useState<"books" | "review" | "stats">("books");
  const [createTab, setCreateTab] = useState<"install" | "custom">("install");
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());
  const [speakingWordId, setSpeakingWordId] = useState<string | null>(null);
  const [speakingExampleId, setSpeakingExampleId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [books, builtIn, statsData] = await Promise.all([
        wordbookApi.list(),
        wordbookApi.listBuiltIn(),
        wordbookApi.getStats(),
      ]);
      setWordbooks(books);
      setBuiltInBooks(builtIn);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load data", err);
    }
    setLoading(false);
  };

  const installBuiltIn = async (id: string) => {
    setInstalling(id);
    try {
      const book = await wordbookApi.installBuiltIn(id);
      setWordbooks([...wordbooks, book]);
    } catch (err) {
      console.error("Failed to install wordbook", err);
    }
    setInstalling(null);
  };

  const selectBook = async (book: WordBookDTO) => {
    setSelectedBook(book);
    try {
      const wordList = await wordbookApi.listWords(book.id);
      setWords(wordList);
    } catch (err) {
      console.error("Failed to load words", err);
    }
  };

  const createBook = async () => {
    if (!newBookName.trim()) return;
    try {
      const book = await wordbookApi.create({ name: newBookName, language: newBookLang });
      setWordbooks([...wordbooks, book]);
      setShowCreate(false);
      setNewBookName("");
    } catch (err) {
      console.error("Failed to create wordbook", err);
    }
  };

  const deleteBook = async (id: string) => {
    if (!confirm("确认删除？")) return;
    try {
      await wordbookApi.delete(id);
      setWordbooks(wordbooks.filter((b) => b.id !== id));
      if (selectedBook?.id === id) {
        setSelectedBook(null);
        setWords([]);
      }
    } catch (err) {
      console.error("Failed to delete wordbook", err);
    }
  };

  const deleteWord = async (id: string) => {
    if (!confirm("确认删除？")) return;
    try {
      await wordbookApi.deleteWord(id);
      setWords(words.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Failed to delete word", err);
    }
  };

  if (loading) {
    return <div className="page-loading">{t("common.loading")}</div>;
  }

  return (
    <div className="wordbook-page">
      <div className="page-header">
        <h1>
          <BookOpen size={24} /> {t("wordbook.title")}
        </h1>
        <div className="tab-bar">
          <button
            className={`tab-btn ${tab === "books" ? "active" : ""}`}
            onClick={() => setTab("books")}
          >
            {t("wordbook.myWordbooks")}
          </button>
          <button
            className={`tab-btn ${tab === "review" ? "active" : ""}`}
            onClick={() => setTab("review")}
          >
            {t("wordbook.review")}
          </button>
          <button
            className={`tab-btn ${tab === "stats" ? "active" : ""}`}
            onClick={() => setTab("stats")}
          >
            {t("wordbook.stats")}
          </button>
        </div>
      </div>

      {tab === "books" && (
        <div className="wordbook-content">
          <div className="wordbook-sidebar">
            <div className="sidebar-header">
              <h3>{t("wordbook.myWordbooks")}</h3>
              <button className="btn btn-sm btn-primary" onClick={() => { setShowCreate(true); setCreateTab("install"); }}>
                <Plus size={14} /> {t("wordbook.createWordbook")}
              </button>
            </div>

            {/* 创建辞书 / 安装内置辞书 对话框 */}
            {showCreate && (
              <div className="create-dialog">
                <div className="create-dialog-tabs">
                  <button
                    className={`tab-btn-sm ${createTab === "install" ? "active" : ""}`}
                    onClick={() => setCreateTab("install")}
                  >
                    📚 安装内置辞书
                  </button>
                  <button
                    className={`tab-btn-sm ${createTab === "custom" ? "active" : ""}`}
                    onClick={() => setCreateTab("custom")}
                  >
                    ✏️ 创建自定义辞书
                  </button>
                  <button className="btn-icon close-btn" onClick={() => setShowCreate(false)}>
                    <X size={14} />
                  </button>
                </div>

                {createTab === "install" && (
                  <div className="install-books-list">
                    {builtInBooks.length === 0 ? (
                      <p className="empty-hint">暂无内置辞书</p>
                    ) : (
                      builtInBooks.map((book) => {
                        const installed = wordbooks.some((b) => b.name === book.name);
                        const isEn = book.id.includes("jp-en");
                        return (
                          <div key={book.id} className="install-book-item">
                            <div className="install-book-info">
                              <span className="book-name">{book.name}</span>
                              <span className="book-count">{book.wordCount} 词</span>
                              <span className={`badge badge-${isEn ? "en" : "zh"}`}>
                                {isEn ? "🇬🇧 英" : "🇨🇳 中"}
                              </span>
                            </div>
                            {installed ? (
                              <span className="badge badge-success">已安装</span>
                            ) : (
                              <button
                                className="btn btn-xs btn-primary"
                                disabled={installing === book.id}
                                onClick={() => installBuiltIn(book.id)}
                              >
                                <Download size={10} />
                                {installing === book.id ? "安装中..." : "安装"}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {createTab === "custom" && (
                  <div className="create-form">
                    <input
                      type="text"
                      placeholder="辞书名称"
                      value={newBookName}
                      onChange={(e) => setNewBookName(e.target.value)}
                    />
                    <select value={newBookLang} onChange={(e) => setNewBookLang(e.target.value)}>
                      <option value="japanese">日本語</option>
                      <option value="english">English</option>
                      <option value="other">其他</option>
                    </select>
                    <div className="form-actions">
                      <button className="btn btn-primary btn-sm" onClick={createBook}>
                        {t("common.create")}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => setShowCreate(false)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="book-list">
              {wordbooks.map((book) => (
                <div
                  key={book.id}
                  className={`book-item ${selectedBook?.id === book.id ? "active" : ""}`}
                  onClick={() => selectBook(book)}
                >
                  <div className="book-info">
                    <span className="book-name">{book.name}</span>
                    <span className="book-count">{book.wordCount} 词</span>
                  </div>
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBook(book.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {wordbooks.length === 0 && (
                <p className="empty-hint">还没有辞书，点击上方按钮安装或创建</p>
              )}
            </div>
          </div>

          <div className="wordbook-main">
            {selectedBook ? (
              <>
                <div className="wordbook-header">
                  <h2>{selectedBook.name}</h2>
                  <span className="badge">{selectedBook.language}</span>
                </div>
                <div className="word-list">
                  {words.map((word) => {
                    const isExpanded = expandedWords.has(word.id);
                    const hasExample = !!word.exampleSentence;
                    return (
                      <div key={word.id} className="word-item">
                        <div className="word-main">
                          <span className="word-text">{word.word}</span>
                          {word.reading && <span className="word-reading">({word.reading})</span>}
                          <span className="word-meaning">{word.meaning}</span>
                        </div>
                        <div className="word-actions">
                          {/* 单词发音按钮 */}
                          <button
                            className="btn-icon btn-speak"
                            title="朗读单词"
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = word.reading || word.word;
                              setSpeakingWordId(word.id);
                              speak(text);
                              setTimeout(() => setSpeakingWordId(null), 1000);
                            }}
                          >
                            <Volume2
                              size={14}
                              className={speakingWordId === word.id ? "speaking" : ""}
                            />
                          </button>
                          {/* 展开例句按钮 */}
                          {hasExample && (
                            <button
                              className="btn-icon"
                              title={isExpanded ? "收起例句" : "展开例句"}
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = new Set(expandedWords);
                                if (isExpanded) {
                                  next.delete(word.id);
                                } else {
                                  next.add(word.id);
                                }
                                setExpandedWords(next);
                              }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                          {word.partOfSpeech && (
                            <span className="word-pos">{word.partOfSpeech}</span>
                          )}
                          <button
                            className="btn-icon"
                            onClick={() => deleteWord(word.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {/* 展开的例句区域 */}
                        {isExpanded && hasExample && (
                          <div className="word-example">
                            <div className="example-sentence">
                              <span className="example-label">📝</span>
                              <span>{word.exampleSentence}</span>
                              <button
                                className="btn-icon btn-speak"
                                title="朗读例句"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSpeakingExampleId(word.id);
                                  speak(word.exampleSentence!);
                                  setTimeout(() => setSpeakingExampleId(null), 1000);
                                }}
                              >
                                <Volume2
                                  size={12}
                                  className={speakingExampleId === word.id ? "speaking" : ""}
                                />
                              </button>
                            </div>
                            {word.exampleTranslation && (
                              <div className="example-translation">
                                <span className="example-label">📖</span>
                                <span>{word.exampleTranslation}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {words.length === 0 && (
                    <p className="empty-state">还没有单词，快去添加吧！</p>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <BookOpen size={48} />
                <p>选择一个辞书查看单词</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "review" && (
        <div className="review-tab">
          <p>今日复习功能即将上线</p>
        </div>
      )}

      {tab === "stats" && stats && (
        <div className="stats-tab">
          <div className="stats-grid">
            <div className="stat-card">
              <BookOpen size={24} />
              <div className="stat-value">{stats.totalWords}</div>
              <div className="stat-label">{t("wordbook.totalWords")}</div>
            </div>
            <div className="stat-card">
              <CheckCircle size={24} />
              <div className="stat-value">{stats.learnedWords}</div>
              <div className="stat-label">{t("wordbook.learned")}</div>
            </div>
            <div className="stat-card">
              <Clock size={24} />
              <div className="stat-value">{stats.reviewingWords}</div>
              <div className="stat-label">{t("wordbook.reviewing")}</div>
            </div>
            <div className="stat-card">
              <Award size={24} />
              <div className="stat-value">{stats.masteredWords}</div>
              <div className="stat-label">{t("wordbook.mastered")}</div>
            </div>
            <div className="stat-card">
              <Calendar size={24} />
              <div className="stat-value">{stats.streakDays}</div>
              <div className="stat-label">{t("wordbook.streak")}</div>
            </div>
            <div className="stat-card">
              <BarChart3 size={24} />
              <div className="stat-value">{stats.todayReviewCount}</div>
              <div className="stat-label">{t("wordbook.nextReview")}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
