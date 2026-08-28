"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Info,
  Sliders,
  Power,
  Clock,
  Zap,
  BarChart3,
  GitMerge,
  Binary,
  Layers,
  ArrowUpDown,
  ListFilter,
  Loader2,
  Activity,
  CheckCircle2,
  Music,
  Gamepad2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Upload,
  Image as ImageIcon,
  Type,
  Calculator,
  HelpCircle,
  FileText,
  Play,
  Plus,
  Route,
  Shuffle,
  ArrowDownNarrowWide,
  TrendingUp,
  RotateCcw,
  SkipBack,
  SkipForward,
  Pause,
  Square,
  Check,
  X,
  Search,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { parseGIF, decompressFrames } from "gifuct-js";

interface LeaderboardEntry {
  name: string;
  score: number;
  mode: string;
  date: string;
}

interface AlgoOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}

interface PFNode {
  r: number;
  c: number;
  isWall: boolean;
  isStart: boolean;
  isTarget: boolean;
  distance: number;
  h: number;
  f: number;
  isVisited: boolean;
  parent: PFNode | null;
}

const solvePathfinding = (
  grid: string[][],
  start: { r: number; c: number },
  target: { r: number; c: number },
  algo: string
) => {
  const ROWS = 24;
  const COLS = 20;
  const nodes: PFNode[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: PFNode[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push({
        r,
        c,
        isWall: grid[r][c] === "wall",
        isStart: r === start.r && c === start.c,
        isTarget: r === target.r && c === target.c,
        distance: Infinity,
        h: 0,
        f: Infinity,
        isVisited: false,
        parent: null,
      });
    }
    nodes.push(row);
  }

  const startNode = nodes[start.r][start.c];
  const targetNode = nodes[target.r][target.c];
  startNode.distance = 0;

  const visitedNodesInOrder: PFNode[] = [];

  if (algo === "bfs") {
    const queue: PFNode[] = [startNode];
    startNode.isVisited = true;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.isWall) continue;
      
      visitedNodesInOrder.push(current);
      if (current === targetNode) break;

      const neighbors = getPFNeighbors(current, nodes);
      for (const neighbor of neighbors) {
        if (!neighbor.isVisited && !neighbor.isWall) {
          neighbor.isVisited = true;
          neighbor.parent = current;
          queue.push(neighbor);
        }
      }
    }
  } else if (algo === "dfs") {
    const stack: PFNode[] = [startNode];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.isWall) continue;
      if (current.isVisited) continue;

      current.isVisited = true;
      visitedNodesInOrder.push(current);
      if (current === targetNode) break;

      const neighbors = getPFNeighbors(current, nodes);
      for (const neighbor of neighbors) {
        if (!neighbor.isVisited && !neighbor.isWall) {
          neighbor.parent = current;
          stack.push(neighbor);
        }
      }
    }
  } else if (algo === "dijkstra" || algo === "astar") {
    const unvisitedNodes: PFNode[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        unvisitedNodes.push(nodes[r][c]);
      }
    }

    if (algo === "astar") {
      startNode.h = Math.abs(startNode.r - target.r) + Math.abs(startNode.c - target.c);
      startNode.f = startNode.h;
    }

    while (unvisitedNodes.length > 0) {
      unvisitedNodes.sort((a, b) => {
        if (algo === "astar") {
          if (a.f === b.f) return a.h - b.h;
          return a.f - b.f;
        }
        return a.distance - b.distance;
      });

      const closestNode = unvisitedNodes.shift()!;
      if (closestNode.isWall) continue;
      if (closestNode.distance === Infinity) break;

      closestNode.isVisited = true;
      visitedNodesInOrder.push(closestNode);

      if (closestNode === targetNode) break;

      const neighbors = getPFNeighbors(closestNode, nodes);
      for (const neighbor of neighbors) {
        if (neighbor.isVisited || neighbor.isWall) continue;
        const tentativeDistance = closestNode.distance + 1;
        if (tentativeDistance < neighbor.distance) {
          neighbor.distance = tentativeDistance;
          neighbor.parent = closestNode;
          if (algo === "astar") {
            neighbor.h = Math.abs(neighbor.r - target.r) + Math.abs(neighbor.c - target.c);
            neighbor.f = neighbor.distance + neighbor.h;
          }
        }
      }
    }
  }

  const shortestPath: PFNode[] = [];
  let current: PFNode | null = targetNode;
  if (targetNode.parent) {
    while (current !== null) {
      shortestPath.unshift(current);
      current = current.parent;
    }
  }

  return { visitedNodesInOrder, shortestPath };
};

const getPFNeighbors = (node: PFNode, nodes: PFNode[][]) => {
  const neighbors: PFNode[] = [];
  const { r, c } = node;
  const ROWS = 24;
  const COLS = 20;
  if (r > 0) neighbors.push(nodes[r - 1][c]);
  if (r < ROWS - 1) neighbors.push(nodes[r + 1][c]);
  if (c > 0) neighbors.push(nodes[r][c - 1]);
  if (c < COLS - 1) neighbors.push(nodes[r][c + 1]);
  return neighbors;
};

interface MatrixButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  actionKey: string;
  actionStates: Record<string, "idle" | "loading" | "success" | "error">;
  defaultText: string;
  icon?: React.ComponentType<{ className?: string }>;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

const MatrixButton: React.FC<MatrixButtonProps> = ({
  actionKey,
  actionStates,
  defaultText,
  icon: Icon,
  loadingText = "Sending...",
  successText = "Sent!",
  errorText = "Failed!",
  className,
  variant,
  disabled,
  onClick,
  ...props
}) => {
  const state = actionStates[actionKey] || "idle";
  return (
    <Button 
      onClick={onClick} 
      className={className} 
      variant={variant} 
      disabled={disabled || state === "loading"}
      {...props}
    >
      {state === "loading" ? (
        <><Loader2 className="animate-spin w-4 h-4 mr-2" /> {loadingText}</>
      ) : state === "success" ? (
        <><Check className="w-4 h-4 mr-2 text-green-500" /> {successText}</>
      ) : state === "error" ? (
        <><X className="w-4 h-4 mr-2 text-red-500" /> {errorText}</>
      ) : (
        <>{Icon && <Icon className="w-4 h-4 mr-2" />} {defaultText}</>
      )}
    </Button>
  );
};

export default function LEDMatrixDashboard() {
  const [activeAlgo, setActiveAlgo] = useState<string | null>(null);
  const [loadingAlgo, setLoadingAlgo] = useState<string | null>(null);
  const { toast } = useToast();

  const [actionStates, setActionStates] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  const setActionState = useCallback((key: string, state: "idle" | "loading" | "success" | "error") => {
    setActionStates((prev) => ({ ...prev, [key]: state }));
    if (state === "success" || state === "error") {
      setTimeout(() => {
        setActionStates((prev) => ({ ...prev, [key]: "idle" }));
      }, 2000);
    }
  }, []);

  // Local settings state for each sorting algorithm card
  const [algoSettings, setAlgoSettings] = useState<Record<string, { speed: number; sound: boolean; volume: number }>>({
    bubble: { speed: 0.1, sound: true, volume: 50 },
    insertion: { speed: 0.1, sound: true, volume: 50 },
    merge: { speed: 0.1, sound: true, volume: 50 },
    quick: { speed: 0.05, sound: true, volume: 50 },
    cocktail: { speed: 0.1, sound: true, volume: 50 },
    selection: { speed: 0.1, sound: true, volume: 50 },
    radix: { speed: 0.1, sound: true, volume: 50 },
    bogo: { speed: 0.1, sound: true, volume: 50 },
    lifegoeson: { speed: 0.1, sound: true, volume: 50 },
  });

  const [activeTab, setActiveTab] = useState("sorts");

  // Fixed Hydration Mismatch: Use a static pre-shuffled array for initial state
  const [sortArray, setSortArray] = useState<number[]>([
    14, 7, 21, 3, 11, 19, 5, 17, 9, 15, 2, 20, 8, 12, 18, 6, 16, 4, 10, 13
  ]);

  const [globalSortSpeed, setGlobalSortSpeed] = useState(0.1);
  const [globalSortSound, setGlobalSortSound] = useState(true);
  const [globalSortVolume, setGlobalSortVolume] = useState(50);
  const [sortsUnlocked, setSortsUnlocked] = useState(false);
  const [presetSelected, setPresetSelected] = useState<string | null>("random");
  const [searchAlgorithm, setSearchAlgorithm] = useState<string>("linear_search");
  const [searchScenario, setSearchScenario] = useState<string>("average");

  const [csvInputValue, setCsvInputValue] = useState(() => {
    return Array.from({ length: 20 }, (_, i) => i + 2).join(", ");
  });

  useEffect(() => {
    setCsvInputValue(sortArray.join(", "));
  }, [sortArray]);

  interface NavidromeTrack {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    coverArt: string | null;
  }

  interface NavidromeAlbum {
    id: string;
    title: string;
    artist: string;
    songCount: number;
    duration: number;
    coverArt: string | null;
  }

  const [musicQuery, setMusicQuery] = useState("");
  const [musicResults, setMusicResults] = useState<NavidromeTrack[]>([]);
  const [musicAlbums, setMusicAlbums] = useState<NavidromeAlbum[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [songVolume, setSongVolume] = useState<number>(50);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);
  const [isMusicPaused, setIsMusicPaused] = useState(false);
  const [visMode, setVisMode] = useState<string>("loop");
  const [activeAlbumTracks, setActiveAlbumTracks] = useState<NavidromeTrack[]>([]);
  const [matrixState, setMatrixState] = useState<{ algo: string | null; song_id: string | null; is_paused: boolean }>({
    algo: null,
    song_id: null,
    is_paused: false,
  });

  // State polling has been temporarily removed because it was polling a local file 
  // on the user's computer instead of the Raspberry Pi, breaking the UI state.

  const handleVolumeChange = async (vol: number) => {
    setSongVolume(vol);
    try {
      await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algo: "volume",
          volume: vol / 100,
        }),
      });
    } catch (err) {
      console.error("Failed to update live volume:", err);
    }
  };

  const extractArtworkPixels = (coverArtId: string): Promise<number[][][] | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 20;
        canvas.height = 20;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        
        ctx.drawImage(img, 0, 0, 20, 20);
        const imgData = ctx.getImageData(0, 0, 20, 20).data;
        const rgbPixels: number[][] = [];
        for (let i = 0; i < imgData.length; i += 4) {
          rgbPixels.push([imgData[i], imgData[i + 1], imgData[i + 2]]);
        }
        const nestedPixels: number[][][] = [];
        for (let y = 0; y < 20; y++) {
          const row: number[][] = [];
          for (let x = 0; x < 20; x++) {
            row.push(rgbPixels[y * 20 + x]);
          }
          nestedPixels.push(row);
        }
        resolve(nestedPixels);
      };
      img.onerror = () => resolve(null);
      img.src = `/api/navidrome/art?id=${coverArtId}&size=20`;
    });
  };

  // Debounced Navidrome search — fires 300ms after the user stops typing
  useEffect(() => {
    if (musicQuery.trim().length < 3) {
      setMusicResults([]);
      setMusicError(null);
      return;
    }
    const timer = setTimeout(async () => {
      setMusicLoading(true);
      setMusicError(null);
      try {
        const res = await fetch(`/api/navidrome/search?q=${encodeURIComponent(musicQuery.trim())}`);
        const data = await res.json();
        if (data.error) {
          setMusicError(data.error);
          setMusicResults([]);
          setMusicAlbums([]);
        } else {
          setMusicResults(data.songs ?? []);
          setMusicAlbums(data.albums ?? []);
        }
      } catch {
        setMusicError("Could not reach search service.");
        setMusicResults([]);
        setMusicAlbums([]);
      } finally {
        setMusicLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [musicQuery]);



  const lastSyncSortArrayRef = useRef<string>("");
  const syncSortArrayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const syncSortArrayToMatrix = useCallback((arr: number[]) => {
    const arrStr = JSON.stringify(arr);
    if (arrStr === lastSyncSortArrayRef.current) return;
    lastSyncSortArrayRef.current = arrStr;

    if (syncSortArrayTimeoutRef.current) {
      clearTimeout(syncSortArrayTimeoutRef.current);
    }

    syncSortArrayTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/matrix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algo: "bubble",
            type: "update",
            array: arr,
          }),
        });
      } catch (e) {
        console.error("Failed to sync sort array:", e);
      }
    }, 150);
  }, []);

  const generateRandomSortArray = () => {
    const arr = Array.from({ length: 20 }, (_, i) => i + 2);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setSortArray(arr);
    syncSortArrayToMatrix(arr);
  };

  const generateReverseSortArray = () => {
    const arr = Array.from({ length: 20 }, (_, i) => 21 - i);
    setSortArray(arr);
    syncSortArrayToMatrix(arr);
  };

  const generateNearlySortedSortArray = () => {
    const arr = Array.from({ length: 20 }, (_, i) => i + 2);
    for (let k = 0; k < 2; k++) {
      const idx1 = Math.floor(Math.random() * 20);
      const idx2 = Math.floor(Math.random() * 20);
      [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
    }
    setSortArray(arr);
    syncSortArrayToMatrix(arr);
  };



  const [gameX, setGameX] = useState(0);
  const [gameY, setGameY] = useState(0);
  const [gameSending, setGameSending] = useState(false);
  const [gamePingMs, setGamePingMs] = useState<number | null>(null);

  const [imagePixels, setImagePixels] = useState<number[][] | null>(null);
  const [gifFrames, setGifFrames] = useState<{pixels: number[][], delay: number}[] | null>(null);
  const [isGif, setIsGif] = useState(false);
  const [imageSending, setImageSending] = useState(false);
  const [scaleMode, setScaleMode] = useState<"cover" | "contain" | "stretch">("cover");
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Text, Clock, and Countdown display features
  const [selectedFont, setSelectedFont] = useState<string>("font5x7");
  const [scrollText, setScrollText] = useState<boolean>(true);
  const [scrollSpeed, setScrollSpeed] = useState<number>(0.08);
  const [customText, setCustomText] = useState<string>("");
  const [textColor, setTextColor] = useState<string>("green");

  // Utilities State
  const [countdownSeconds, setCountdownSeconds] = useState(60);
  const [clockLayout] = useState<"standard" | "grid2x2" | "centered_colon">("grid2x2");
  const [clockColor, setClockColor] = useState("green");
  const [clockSound, setClockSound] = useState(true);
  const [clockVolume, setClockVolume] = useState(50);
  const [countdownLayout] = useState<"standard" | "grid2x2" | "centered_colon">("grid2x2");
  const [countdownSound, setCountdownSound] = useState(true);
  const [countdownVolume, setCountdownVolume] = useState(50);
  // Math Lab Game Settings & State
  const [gameState, setGameState] = useState<"lobby" | "loading" | "playing" | "gameover">("lobby");
  const [mathIntroTimer, setMathIntroTimer] = useState("ARE YOU READY?");
  const [mathGameMode, setMathGameMode] = useState<"timed" | "free">("timed");
  const [mathTimeLimit, setMathTimeLimit] = useState<number>(60);
  const [mathTimeLeft, setMathTimeLeft] = useState<number>(60);
  const [mathScore, setMathScore] = useState<number>(0);
  const [mathMusic, setMathMusic] = useState<boolean>(false);
  const [selectedMathSong, setSelectedMathSong] = useState<NavidromeTrack | null>(null);
  const [mathMusicQuery, setMathMusicQuery] = useState("");
  const [mathMusicResults, setMathMusicResults] = useState<NavidromeTrack[]>([]);
  const [mathMusicLoading, setMathMusicLoading] = useState(false);
  const [mathMusicVolume, setMathMusicVolume] = useState<number>(40);
  const [allowedMultiplyPhrases, setAllowedMultiplyPhrases] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const [allowedDividePhrases, setAllowedDividePhrases] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [mathSound, setMathSound] = useState(true);
  const [mathVolume, setMathVolume] = useState<number>(50);
  const [globalBrightness, setGlobalBrightness] = useState<number>(127);

  const [mathQuestion, setMathQuestion] = useState<{ factorA: number; factorB: number; type: "multiply" | "divide" }>({ factorA: 3, factorB: 4, type: "multiply" });
  const [userAnswer, setUserAnswer] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Debounced Math Lab background music search
  useEffect(() => {
    if (mathMusicQuery.trim().length < 3) {
      setMathMusicResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setMathMusicLoading(true);
      try {
        const res = await fetch(`/api/navidrome/search?q=${encodeURIComponent(mathMusicQuery.trim())}`);
        const data = await res.json();
        if (data && Array.isArray(data.songs)) {
          setMathMusicResults(data.songs);
        } else {
          setMathMusicResults([]);
        }
      } catch (err) {
        console.error("Failed to query Navidrome for Math Lab music:", err);
        setMathMusicResults([]);
      } finally {
        setMathMusicLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mathMusicQuery]);

  // Load browser storage values after client mounting to prevent SSR hydration mismatches
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVolume = sessionStorage.getItem("matrix_math_volume");
      if (savedVolume) {
        setMathVolume(parseInt(savedVolume, 10));
      }
      const savedBrightness = sessionStorage.getItem("matrix_global_brightness");
      if (savedBrightness) {
        setGlobalBrightness(parseInt(savedBrightness, 10));
      }
      const savedLeaderboard = localStorage.getItem("math_leaderboard");
      if (savedLeaderboard) {
        try {
          setLeaderboard(JSON.parse(savedLeaderboard));
        } catch (e) {
          console.error("Failed to parse leaderboard:", e);
        }
      }
    }
  }, []);

  const gamePosRef = useRef({ x: 0, y: 0 });
  const gameLastSentRef = useRef<number>(0);
  const gameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const COLS = 20;
  const ROWS = 24;
  const THROTTLE_MS = 60;

  // Pathfinding states
  const [pfGrid, setPfGrid] = useState<string[][]>(() => {
    const initial = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        if (r === 6 && c === 4) row.push("start");
        else if (r === 17 && c === 15) row.push("target");
        else row.push("empty");
      }
      initial.push(row);
    }
    return initial;
  });

  const [pfStart, setPfStart] = useState({ r: 6, c: 4 });
  const [pfTarget, setPfTarget] = useState({ r: 17, c: 15 });
  const [pfTool, setPfTool] = useState<"wall" | "start" | "target" | "eraser">("wall");
  const [pfMousePressed, setPfMousePressed] = useState(false);
  const [pfAlgo, setPfAlgo] = useState("dijkstra");
  const [pfSpeed, setPfSpeed] = useState(30); // Speed in ms delay
  const [pfSound, setPfSound] = useState(true);
  const [pfVolume, setPfVolume] = useState(50);
  const [pfIsRunning, setPfIsRunning] = useState(false);
  const [pfSending, setPfSending] = useState(false);

  const pfIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncPfGridTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncPfGridRef = useRef<string>("");

  // Clean up the pathfinding interval if the tab is changed
  useEffect(() => {
    if (activeTab !== "pathfinding") {
      if (pfIntervalRef.current) clearTimeout(pfIntervalRef.current);
      setPfIsRunning(false);
    }
  }, [activeTab]);

  const playBeep = (freq: number) => {
    if (!pfSound) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime((pfVolume / 100) * 0.05, ctx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.05);
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  };

  const handlePfCellInteraction = (r: number, c: number) => {
    if (pfIsRunning) return;

    setPfGrid((prev) => {
      const next = prev.map((row) => [...row]);
      const currentCell = next[r][c];

      if (pfTool === "wall") {
        if (currentCell !== "start" && currentCell !== "target") {
          next[r][c] = "wall";
        }
      } else if (pfTool === "eraser") {
        if (currentCell !== "start" && currentCell !== "target") {
          next[r][c] = "empty";
        }
      } else if (pfTool === "start") {
        if (currentCell !== "target" && currentCell !== "start") {
          // Remove old start
          const oldStartR = pfStart.r;
          const oldStartC = pfStart.c;
          next[oldStartR][oldStartC] = "empty";
          next[r][c] = "start";
          setPfStart({ r, c });
        }
      } else if (pfTool === "target") {
        if (currentCell !== "start" && currentCell !== "target") {
          // Remove old target
          const oldTargetR = pfTarget.r;
          const oldTargetC = pfTarget.c;
          next[oldTargetR][oldTargetC] = "empty";
          next[r][c] = "target";
          setPfTarget({ r, c });
        }
      }
      return next;
    });
  };

  const handleCellMouseDown = (r: number, c: number) => {
    setPfMousePressed(true);
    handlePfCellInteraction(r, c);
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (!pfMousePressed) return;
    handlePfCellInteraction(r, c);
  };

  const handleCellMouseUp = () => {
    setPfMousePressed(false);
  };

  const generateRandomMaze = () => {
    if (pfIsRunning) return;
    resetPfPath();
    setPfGrid((prev) => {
      const next = prev.map((row, r) =>
        row.map((cell, c) => {
          if (cell === "start" || cell === "target") return cell;
          return Math.random() < 0.3 ? "wall" : "empty";
        })
      );
      return next;
    });
  };

  const resetPfPath = () => {
    if (pfIntervalRef.current) clearTimeout(pfIntervalRef.current);
    setPfIsRunning(false);
    setPfGrid((prev) => {
      const next = prev.map((row) =>
        row.map((cell) => (cell === "visited" || cell === "path" ? "empty" : cell))
      );
      return next;
    });
  };

  const clearPfAll = () => {
    if (pfIntervalRef.current) clearTimeout(pfIntervalRef.current);
    setPfIsRunning(false);
    setPfGrid(() => {
      const initial = [];
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
          if (r === pfStart.r && c === pfStart.c) row.push("start");
          else if (r === pfTarget.r && c === pfTarget.c) row.push("target");
          else row.push("empty");
        }
        initial.push(row);
      }
      return initial;
    });
  };

  const runPfVisualiser = () => {
    if (pfIsRunning) return;

    // Reset previous paths first
    setPfGrid((prev) => {
      const next = prev.map((row) =>
        row.map((cell) => (cell === "visited" || cell === "path" ? "empty" : cell))
      );
      return next;
    });

    setPfIsRunning(true);

    const { visitedNodesInOrder, shortestPath } = solvePathfinding(
      pfGrid,
      pfStart,
      pfTarget,
      pfAlgo
    );

    const filteredVisited = visitedNodesInOrder.filter(
      (node) => !node.isStart && !node.isTarget
    );
    const filteredPath = shortestPath.filter(
      (node) => !node.isStart && !node.isTarget
    );

    let step = 0;
    const animate = () => {
      if (step < filteredVisited.length) {
        const node = filteredVisited[step];
        setPfGrid((prev) => {
          const next = prev.map((row, r) =>
            row.map((cell, c) => (r === node.r && c === node.c ? "visited" : cell))
          );
          return next;
        });

        const freq = 120 + ((node.r * COLS + node.c) % 480) * 1.5;
        playBeep(freq);

        step++;
        pfIntervalRef.current = setTimeout(animate, pfSpeed);
      } else {
        let pathStep = 0;
        const animatePath = () => {
          if (pathStep < filteredPath.length) {
            const node = filteredPath[pathStep];
            setPfGrid((prev) => {
              const next = prev.map((row, r) =>
                row.map((cell, c) => (r === node.r && c === node.c ? "path" : cell))
              );
              return next;
            });

            const freq = 400 + pathStep * 30;
            playBeep(freq);

            pathStep++;
            pfIntervalRef.current = setTimeout(animatePath, pfSpeed * 1.5);
          } else {
            setPfIsRunning(false);

            if (shortestPath.length > 0) {
              playBeep(523.25);
              setTimeout(() => playBeep(659.25), 100);
              setTimeout(() => playBeep(783.99), 200);
              setTimeout(() => playBeep(1046.50), 300);
            }

          }
        };
        animatePath();
      }
    };

    animate();
  };

  const runPfOnMatrix = async () => {
    if (pfSending) return;

    // Find all wall coordinates
    const wallCoordinates: [number, number][] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (pfGrid[r][c] === "wall") {
          wallCoordinates.push([r, c]);
        }
      }
    }

    setPfSending(true);
    setActionState("run_pf", "loading");

    try {
      const response = await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algo: "pathfinding",
          type: pfAlgo,
          start: [pfStart.r, pfStart.c],
          target: [pfTarget.r, pfTarget.c],
          walls: wallCoordinates,
          speed: pfSpeed / 1000,
          sound: pfSound,
          volume: pfVolume / 100,
        }),
      });

      if (response.ok) {
        setActiveAlgo("pathfinding");
        setActionState("run_pf", "success");
      } else {
        setActionState("run_pf", "error");
      }
    } catch (err: any) {
      setActionState("run_pf", "error");
    } finally {
      setPfSending(false);
    }
  };

  const syncPfGridToMatrix = useCallback((grid: string[][], start: { r: number; c: number }, target: { r: number; c: number }) => {
    const gridStr = JSON.stringify({ start, target, grid });
    if (gridStr === lastSyncPfGridRef.current) return;
    lastSyncPfGridRef.current = gridStr;

    if (syncPfGridTimeoutRef.current) {
      clearTimeout(syncPfGridTimeoutRef.current);
    }

    syncPfGridTimeoutRef.current = setTimeout(async () => {
      // Find all wall coordinates
      const wallCoordinates: [number, number][] = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c] === "wall") {
            wallCoordinates.push([r, c]);
          }
        }
      }

      try {
        await fetch("/api/matrix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algo: "pathfinding",
            type: "update",
            start: [start.r, start.c],
            target: [target.r, target.c],
            walls: wallCoordinates,
            speed: 0.1,
            sound: false,
            volume: 0,
          }),
        });
      } catch (e) {
        console.error("Failed to sync pathfinding grid:", e);
      }
    }, 150); // 150ms throttle delay to smooth out drag painting
  }, []);

  // Monitor grid edits, clears, random mazes, and node moves to replicate immediately on physical display
  useEffect(() => {
    if (activeTab === "pathfinding" && !pfIsRunning) {
      syncPfGridToMatrix(pfGrid, pfStart, pfTarget);
    }
  }, [pfGrid, pfStart, pfTarget, activeTab, pfIsRunning, syncPfGridToMatrix]);

  // Add mouseUp listener to window to ensure we release press even if drag ends outside grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setPfMousePressed(false);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Keep ref up to date to prevent closure issues in event handlers
  useEffect(() => {
    gamePosRef.current = { x: gameX, y: gameY };
  }, [gameX, gameY]);

  const sendGameCoordinate = useCallback(async (targetX: number, targetY: number) => {
    const now = Date.now();
    const timeSinceLastSent = now - gameLastSentRef.current;

    const performSend = async () => {
      setGameSending(true);
      const startTime = Date.now();
      try {
        const response = await fetch("/api/matrix", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            algo: "game",
            x: targetX,
            y: targetY,
            speed: 0.1,
            sound: false,
            volume: 0
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `HTTP error ${response.status}`);
        }

        setGamePingMs(Date.now() - startTime);
      } catch (err: any) {
        console.error(err.message || "Failed to update light coordinates.");
      } finally {
        setGameSending(false);
      }
      gameLastSentRef.current = Date.now();
    };

    if (timeSinceLastSent >= THROTTLE_MS) {
      if (gameTimeoutRef.current) {
        clearTimeout(gameTimeoutRef.current);
        gameTimeoutRef.current = null;
      }
      performSend();
    } else {
      if (gameTimeoutRef.current) clearTimeout(gameTimeoutRef.current);
      gameTimeoutRef.current = setTimeout(() => {
        performSend();
      }, THROTTLE_MS - timeSinceLastSent);
    }
  }, [toast]);

  const moveGame = useCallback((dx: number, dy: number) => {
    const current = gamePosRef.current;
    const newX = Math.max(0, Math.min(COLS - 1, current.x + dx));
    const newY = Math.max(0, Math.min(ROWS - 1, current.y + dy));

    if (newX !== current.x || newY !== current.y) {
      setGameX(newX);
      setGameY(newY);
      sendGameCoordinate(newX, newY);
    }
  }, [sendGameCoordinate]);

  // Handle keys when tab is active
  useEffect(() => {
    if (activeTab !== "game") {
      if (activeAlgo === "game") {
        setActiveAlgo(null);
      }
      return;
    }

    // Blur focus so Radix UI TabsTrigger doesn't capture ArrowLeft/Right keys
    if (typeof document !== "undefined") {
      setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 50);
    }

    setActiveAlgo("game");
    setGameX(0);
    setGameY(0);
    sendGameCoordinate(0, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case "ArrowUp":
          moveGame(0, -1);
          break;
        case "ArrowDown":
          moveGame(0, 1);
          break;
        case "ArrowLeft":
          moveGame(-1, 0);
          break;
        case "ArrowRight":
          moveGame(1, 0);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (gameTimeoutRef.current) {
        clearTimeout(gameTimeoutRef.current);
      }
    };
  }, [activeTab, activeAlgo, moveGame, sendGameCoordinate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    processImage(file, scaleMode);
  };

  const processImage = async (file: File, mode: "cover" | "contain" | "stretch") => {
    if (file.type === "image/gif") {
      setIsGif(true);
      setImagePixels(null);
      try {
        const buffer = await file.arrayBuffer();
        const gif = parseGIF(buffer);
      const frames = decompressFrames(gif, true);
      
      const parsedGifFrames: {pixels: number[][], delay: number}[] = [];
      
      if (frames.length > 0) {
        const gifWidth = frames[0].dims.width || gif.lsd.width;
        const gifHeight = frames[0].dims.height || gif.lsd.height;
        
        const persistentCanvas = document.createElement("canvas");
        persistentCanvas.width = gifWidth;
        persistentCanvas.height = gifHeight;
        const persistentCtx = persistentCanvas.getContext("2d");
        
        let backupCanvas: HTMLCanvasElement | null = null;
        
        if (persistentCtx) {
          for (const frame of frames) {
            // Save state for disposal type 3 (restore to previous)
            if (frame.disposalType === 3) {
              backupCanvas = document.createElement("canvas");
              backupCanvas.width = gifWidth;
              backupCanvas.height = gifHeight;
              backupCanvas.getContext("2d")?.drawImage(persistentCanvas, 0, 0);
            }
            
            // Draw current frame patch
            if (frame.patch) {
              const tempCanvas = document.createElement("canvas");
              tempCanvas.width = frame.dims.width;
              tempCanvas.height = frame.dims.height;
              const tempCtx = tempCanvas.getContext("2d");
              if (tempCtx) {
                const frameImageData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
                frameImageData.data.set(frame.patch);
                tempCtx.putImageData(frameImageData, 0, 0);
                persistentCtx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);
              }
            }

            // Scale persistent canvas to matrix size
            const canvas = document.createElement("canvas");
            canvas.width = COLS;
            canvas.height = ROWS;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#000000";
              ctx.fillRect(0, 0, COLS, ROWS);

              let drawW = COLS;
              let drawH = ROWS;
              let offsetX = 0;
              let offsetY = 0;
              const imgRatio = gifWidth / gifHeight;
              const canvasRatio = COLS / ROWS;

              if (mode === "stretch") {
                ctx.drawImage(persistentCanvas, 0, 0, COLS, ROWS);
              } else if (mode === "cover") {
                if (imgRatio > canvasRatio) {
                  drawW = ROWS * imgRatio;
                  offsetX = (COLS - drawW) / 2;
                } else {
                  drawH = COLS / imgRatio;
                  offsetY = (ROWS - drawH) / 2;
                }
                ctx.drawImage(persistentCanvas, offsetX, offsetY, drawW, drawH);
              } else if (mode === "contain") {
                if (imgRatio > canvasRatio) {
                  drawH = COLS / imgRatio;
                  offsetY = (ROWS - drawH) / 2;
                } else {
                  drawW = ROWS * imgRatio;
                  offsetX = (COLS - drawW) / 2;
                }
                ctx.drawImage(persistentCanvas, offsetX, offsetY, drawW, drawH);
              }

              const imgData = ctx.getImageData(0, 0, COLS, ROWS).data;
              const rgbPixels: number[][] = [];
              for (let i = 0; i < imgData.length; i += 4) {
                rgbPixels.push([imgData[i], imgData[i + 1], imgData[i + 2]]);
              }
              // gifuct-js delay is already converted to milliseconds in the returned frame object.
              const delayMs = frame.delay ? Math.max(20, frame.delay) : 100;
              parsedGifFrames.push({ pixels: rgbPixels, delay: delayMs });
            }
            
            // Handle disposal for next frame
            if (frame.disposalType === 2) {
              // Restore to background (clear the patch area)
              persistentCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
            } else if (frame.disposalType === 3 && backupCanvas) {
              // Restore to previous
              persistentCtx.clearRect(0, 0, gifWidth, gifHeight);
              persistentCtx.drawImage(backupCanvas, 0, 0);
            }
          }
        }
      }
      setGifFrames(parsedGifFrames);
      return;
      } catch (err) {
        console.error("GIF parsing failed:", err);
      }
    }

    setIsGif(false);
    setGifFrames(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = COLS;
        canvas.height = ROWS;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear canvas with black background
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, COLS, ROWS);

        let drawW = COLS;
        let drawH = ROWS;
        let offsetX = 0;
        let offsetY = 0;

        if (mode === "stretch") {
          ctx.drawImage(img, 0, 0, COLS, ROWS);
        } else {
          const imgRatio = img.width / img.height;
          const canvasRatio = COLS / ROWS;

          if (mode === "cover") {
            if (imgRatio > canvasRatio) {
              drawW = ROWS * imgRatio;
              offsetX = (COLS - drawW) / 2;
            } else {
              drawH = COLS / imgRatio;
              offsetY = (ROWS - drawH) / 2;
            }
          } else if (mode === "contain") {
            if (imgRatio > canvasRatio) {
              drawH = COLS / imgRatio;
              offsetY = (ROWS - drawH) / 2;
            } else {
              drawW = ROWS * imgRatio;
              offsetX = (COLS - drawW) / 2;
            }
          }
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        }

        const imgData = ctx.getImageData(0, 0, COLS, ROWS).data;
        const rgbPixels: number[][] = [];
        for (let i = 0; i < imgData.length; i += 4) {
          rgbPixels.push([imgData[i], imgData[i + 1], imgData[i + 2]]);
        }
        setImagePixels(rgbPixels);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Re-process when scaleMode changes
  useEffect(() => {
    if (fileInputRef.current?.files?.[0]) {
      processImage(fileInputRef.current.files[0], scaleMode);
    }
  }, [scaleMode]);

  const handleSendImage = async () => {
    if (!imagePixels && !gifFrames) return;
    setImageSending(true);
    setActionState("send_image", "loading");

    try {
      const response = await fetch("/api/matrix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isGif ? {
          algo: "gif",
          frames: gifFrames,
        } : {
          algo: "image",
          pixels: imagePixels,
        }),
      });

      if (response.ok) {
        setActiveAlgo(isGif ? "gif" : "image");
        setActionState("send_image", "success");
      } else {
        setActionState("send_image", "error");
      }
    } catch (err: any) {
      setActionState("send_image", "error");
    } finally {
      setImageSending(false);
    }
  };

  const handleSendText = async () => {
    if (!customText.trim()) return;
    setLoadingAlgo("text");
    setActionState("send_text", "loading");
    try {
      const response = await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algo: "text",
          text: customText,
          font: selectedFont,
          scroll: scrollText,
          speed: scrollSpeed,
          sound: false,
          volume: 0,
          color: textColor,
        }),
      });

      if (response.ok) {
        setActiveAlgo("text");
        setActionState("send_text", "success");
      } else {
        setActionState("send_text", "error");
      }
    } catch (err: any) {
      setActionState("send_text", "error");
    } finally {
      setLoadingAlgo(null);
    }
  };

  const handleSendTime = async () => {
    setLoadingAlgo("time");
    setActionState("send_time", "loading");
    try {
      const response = await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algo: "time",
          font: selectedFont,
          scroll: scrollText,
          speed: scrollSpeed,
          sound: clockSound,
          volume: clockVolume / 100,
          layout: clockLayout,
          color: clockColor,
        }),
      });

      if (response.ok) {
        setActiveAlgo("time");
        setActionState("send_time", "success");
      } else {
        setActionState("send_time", "error");
      }
    } catch (err: any) {
      setActionState("send_time", "error");
    } finally {
      setLoadingAlgo(null);
    }
  };

  const handleSendCountdown = async () => {
    setLoadingAlgo("countdown");
    setActionState("send_countdown", "loading");
    try {
      const response = await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algo: "countdown",
          seconds: countdownSeconds,
          font: selectedFont,
          scroll: scrollText,
          speed: scrollSpeed,
          sound: countdownSound,
          volume: countdownVolume / 100,
          layout: countdownLayout,
          color: "green",
        }),
      });

      if (response.ok) {
        setActiveAlgo("countdown");
        setActionState("send_countdown", "success");
      } else {
        setActionState("send_countdown", "error");
      }
    } catch (err: any) {
      setActionState("send_countdown", "error");
    } finally {
      setLoadingAlgo(null);
    }
  };

  const handleRickroll = async () => {
    try {
      setGlobalBrightness(255);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("matrix_global_brightness", "255");
      }

      await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ algo: "rickroll", brightness: 255 }),
      });
    } catch (err) {
      console.error("Rickroll failed:", err);
    }
  };

  const generateNewQuestion = useCallback(async () => {
    setAnswerFeedback(null);
    setUserAnswer("");

    const isMultiply = Math.random() < 0.5;
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;

    let newQuestion;
    if (isMultiply) {
      newQuestion = { factorA: a, factorB: b, type: "multiply" as const };
    } else {
      const product = a * b;
      newQuestion = { factorA: product, factorB: b, type: "divide" as const };
    }
    setMathQuestion(newQuestion);

    // Call API to display the question matrix and speak it aloud
    try {
      await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algo: "math_question",
          type: newQuestion.type,
          factorA: newQuestion.factorA,
          factorB: newQuestion.factorB,
          sound: mathSound,
          volume: mathVolume / 100,
          allowed_multiply: allowedMultiplyPhrases,
          allowed_divide: allowedDividePhrases,
        }),
      });
    } catch (err) {
      console.error("Failed to trigger math question:", err);
    }
  }, [mathSound, mathVolume]);

  const handleUpdateBrightness = async (value: number) => {
    setGlobalBrightness(value);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("matrix_global_brightness", value.toString());
    }
    try {
      await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algo: "brightness",
          brightness: value,
        }),
      });
    } catch (err) {
      console.error("Failed to update matrix brightness:", err);
    }
  };

  const handleStopAll = async () => {
    setActionState("stop_matrix", "loading");
    try {
      await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ algo: "idle" }),
      });
      setActionState("stop_matrix", "success");
    } catch (err) {
      console.error(err);
      setActionState("stop_matrix", "error");
    }
  };

  const numPadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Backspace", "0", "Enter"];

  const getButtonLabel = (key: string) => {
    if (key === "Backspace") return "⌫";
    if (key === "Enter") return "Submit";
    return key;
  };

  const isKeyPressed = (key: string) => {
    if (key === "Backspace") return activeKeys.has("Backspace");
    if (key === "Enter") return activeKeys.has("Enter") || activeKeys.has("NumpadEnter");
    return activeKeys.has(key);
  };

  const handleNumPadPress = (key: string) => {
    if (key >= "0" && key <= "9") {
      setUserAnswer((prev) => prev + key);
    } else if (key === "Backspace") {
      setUserAnswer((prev) => prev.slice(0, -1));
    } else if (key === "Enter") {
      handleCheckAnswer();
    }
  };

  const handleCheckAnswer = async () => {
    const numericAnswer = parseInt(userAnswer.trim(), 10);
    let expected = 0;
    if (mathQuestion.type === "multiply") {
      expected = mathQuestion.factorA * mathQuestion.factorB;
    } else {
      expected = mathQuestion.factorA / mathQuestion.factorB;
    }

    const isCorrect = numericAnswer === expected;
    const soundFile = isCorrect ? "ding.wav" : "error.wav";

    if (isCorrect) {
      setAnswerFeedback("correct");
      if (gameState === "playing" && mathGameMode === "timed") {
        setMathScore((prev) => prev + 1);
      }
      // Automatically advance to the next question after 1.2 seconds
      setTimeout(() => {
        generateNewQuestion();
      }, 1200);
    } else {
      setAnswerFeedback("incorrect");
    }

    // Play sound on the physical Pi Zero display
    await fetch("/api/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        algo: "math_feedback",
        sound: mathSound,
        volume: mathVolume / 100,
        sound_file: soundFile,
      }),
    }).catch(() => {});
  };

  const handleRunMathVisualisation = async () => {
    // Send help request to the Pi Zero
    await fetch("/api/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        algo: "math_help",
        type: mathQuestion.type,
        factorA: mathQuestion.factorA,
        factorB: mathQuestion.factorB,
        sound: mathSound,
        volume: mathVolume / 100,
      }),
    }).catch(() => {});
  };

  const handleSaveScore = () => {
    if (!playerName.trim()) return;

    const newEntry: LeaderboardEntry = {
      name: playerName.trim(),
      score: mathScore,
      mode: `Timed - ${mathTimeLimit}s`,
      date: new Date().toLocaleDateString(),
    };

    const updated = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Keep top 10

    setLeaderboard(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("math_leaderboard", JSON.stringify(updated));
    }
    setGameState("lobby");
    setPlayerName("");
    // Reset game status in DB
    fetch("/api/matrix/game-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "lobby" }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (activeTab !== "math") {
      setGameState("lobby");
      if (timerRef.current) clearInterval(timerRef.current);
      // Reset game status in DB
      fetch("/api/matrix/game-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "lobby" }),
      }).catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    if (gameState === "playing" && mathGameMode === "timed") {
      setMathTimeLeft(mathTimeLimit);
      timerRef.current = setInterval(() => {
        setMathTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setGameState("gameover");
            // Update session status in DB to gameover
            fetch("/api/matrix/game-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "gameover" }),
            }).catch(() => {});
            // Play tada sound on Pi Zero at the end of the timed game
            fetch("/api/matrix", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                algo: "math_feedback",
                sound: mathSound,
                volume: mathVolume / 100,
                sound_file: "tada.wav",
              }),
            }).catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, mathGameMode, mathTimeLimit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== "playing") return;

      const key = e.key;

      // Prevent browser shortcuts or scrolling for numpad keys
      if (["0","1","2","3","4","5","6","7","8","9","Backspace","Enter"].includes(key)) {
        e.preventDefault();
      }

      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      if (key >= "0" && key <= "9") {
        setUserAnswer((prev) => prev + key);
      } else if (key === "Backspace") {
        setUserAnswer((prev) => prev.slice(0, -1));
      } else if (key === "Enter") {
        handleCheckAnswer();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, userAnswer, mathQuestion]);

  const updateAlgoSetting = (algoId: string, key: "speed" | "sound" | "volume", value: any) => {
    setAlgoSettings(prev => ({
      ...prev,
      [algoId]: {
        ...prev[algoId],
        [key]: value
      }
    }));
  };

  const sortingAlgos: AlgoOption[] = [
    {
      id: "bubble",
      name: "Bubble Sort",
      description: "Visualises classic adjacent swaps with logarithmic frequency tones.",
      icon: BarChart3,
      color: "from-pink-500 to-rose-500",
    },
    {
      id: "insertion",
      name: "Insertion Sort",
      description: "Builds a final sorted array element-by-element with tick audio cues.",
      icon: Layers,
      color: "from-emerald-500 to-teal-500",
    },
    {
      id: "merge",
      name: "Merge Sort",
      description: "Divide-and-merge array segments recursively using buffer tracks.",
      icon: GitMerge,
      color: "from-orange-500 to-amber-500",
    },
    {
      id: "quick",
      name: "Quick Sort",
      description: "Divide-and-conquer pivot partitioning with tone sweeps.",
      icon: Zap,
      color: "from-purple-500 to-indigo-500",
    },
    {
      id: "cocktail",
      name: "Cocktail Sort",
      description: "Bidirectional bubble sort that sweeps elements back and forth.",
      icon: ArrowUpDown,
      color: "from-teal-500 to-emerald-600",
    },
    {
      id: "selection",
      name: "Selection Sort",
      description: "Repeatedly finds the minimum element and places it at the beginning.",
      icon: ListFilter,
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "radix",
      name: "Radix Sort",
      description: "Non-comparative sorting based on individual digit columns.",
      icon: Binary,
      color: "from-violet-500 to-fuchsia-500",
    },
    {
      id: "bogo",
      name: "Bogo Sort",
      description: "Randomly shuffles elements and checks if sorted. High average complexity.",
      icon: Activity,
      color: "from-stone-400 to-stone-500",
    },
  ];

  const systemCmds: AlgoOption[] = [
    {
      id: "shutdown",
      name: "Power Down Matrix",
      description: "Turn off all LED rails and shut down the Raspberry Pi brain safely.",
      icon: Power,
      color: "from-red-600 to-red-800",
    },
  ];

  const handleTriggerAlgo = async (algo: AlgoOption) => {
    setLoadingAlgo(algo.id);
    setActionState(algo.id, "loading");

    const settings = algoSettings[algo.id] || { speed: 0.1, sound: true, volume: 50 };
    const isSortingAlgo = ["bubble", "insertion", "merge", "quick", "selection", "radix", "bogo", "cocktail"].includes(algo.id);
    const isSearchAlgo = ["linear_search", "binary_search"].includes(algo.id);
    let activeArray = sortArray;
    let targetValue: number | undefined = undefined;

    if (isSortingAlgo && !presetSelected) {
      const arr = Array.from({ length: 20 }, (_, i) => i + 2);
      for (let i = 0; i < 50; i++) {
        const idx1 = Math.floor(Math.random() * 20);
        const idx2 = Math.floor(Math.random() * 20);
        [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
      }
      activeArray = arr;
      setSortArray(arr);
      setPresetSelected("random");
    }

    if (isSearchAlgo) {
      let arr = Array.from({ length: 20 }, (_, i) => i + 2);
      if (algo.id === "binary_search") {
        // Binary search requires sorted array
        arr.sort((a, b) => a - b);
      } else {
        // Linear search shuffled
        for (let i = 0; i < 50; i++) {
          const idx1 = Math.floor(Math.random() * 20);
          const idx2 = Math.floor(Math.random() * 20);
          [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
        }
      }
      activeArray = arr;
      
      if (searchScenario === "best") {
        targetValue = algo.id === "binary_search" ? arr[9] : arr[0];
      } else if (searchScenario === "worst") {
        targetValue = Math.random() < 0.1 ? 999 : arr[arr.length - 1]; // 10% not found, 90% at the very end
      } else {
        targetValue = arr[Math.floor(Math.random() * 20)];
      }
    }

    const speedVal = isSortingAlgo || isSearchAlgo ? globalSortSpeed : settings.speed;
    const soundVal = isSortingAlgo || isSearchAlgo ? globalSortSound : settings.sound;
    const volumeVal = isSortingAlgo || isSearchAlgo ? globalSortVolume : settings.volume;

    try {
      const response = await fetch("/api/matrix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          algo: algo.id,
          speed: speedVal,
          sound: soundVal,
          volume: volumeVal / 100,
          array: (isSortingAlgo || isSearchAlgo) ? activeArray : undefined,
          target: targetValue
        }),
      });

      if (response.ok) {
        setActiveAlgo(algo.id);
        setActionState(algo.id, "success");
      } else {
        setActionState(algo.id, "error");
      }
    } catch (error) {
      console.error("Error triggering matrix command:", error);
      setActionState(algo.id, "error");
    } finally {
      setLoadingAlgo(null);
    }
  };

  return (
    <div className="neo-archive-root min-h-screen p-4 md:p-8 bg-[#E2D5BA] text-[#1E1E1E]">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');

        .neo-archive-root {
          --bg-app: #E2D5BA;
          --bg-surface: #FDFBF7;
          --border-default: rgba(30, 30, 30, 0.8);
          --primary: #1E1E1E;
          --text-primary: #1E1E1E;
          --text-secondary: #5E5E5E;
          --text-muted: #7E7E7E;
          
          background-color: var(--bg-app) !important;
          color: var(--text-primary) !important;
          font-family: 'Inter', sans-serif !important;
        }

        .neo-archive-root * {
          font-family: 'Inter', sans-serif !important;
          border-radius: 0px !important;
          box-shadow: none !important;
        }

        /* Scaled Text Sizing overrides */
        .neo-archive-root .text-\\[9px\\] { font-size: 11px !important; }
        .neo-archive-root .text-\\10px\\] { font-size: 12px !important; } /* Handle alternate selectors */
        .neo-archive-root .text-\\[10px\\] { font-size: 12px !important; }
        .neo-archive-root .text-\\[11px\\] { font-size: 13px !important; }
        .neo-archive-root .text-xs { font-size: 14px !important; }
        .neo-archive-root .text-sm { font-size: 16px !important; }
        .neo-archive-root .text-base { font-size: 18px !important; }
        .neo-archive-root .text-lg { font-size: 20px !important; }
        .neo-archive-root .text-xl { font-size: 24px !important; }
        .neo-archive-root .text-2xl { font-size: 28px !important; }
        .neo-archive-root .text-3xl { font-size: 32px !important; }
        .neo-archive-root .text-4xl { font-size: 38px !important; }
        .neo-archive-root .text-5xl { font-size: 48px !important; }

        /* Headings & Serif Fonts */
        .neo-archive-root .font-serif,
        .neo-archive-root h1,
        .neo-archive-root h2,
        .neo-archive-root h3,
        .neo-archive-root h4,
        .neo-archive-root .neo-serif {
          font-family: 'Playfair Display', serif !important;
        }

        /* Sans-serif Display Fonts */
        .neo-archive-root .font-sans-display,
        .neo-archive-root .neo-display {
          font-family: 'Outfit', sans-serif !important;
        }

        /* Monospace Fonts */
        .neo-archive-root .font-mono,
        .neo-archive-root code,
        .neo-archive-root pre,
        .neo-archive-root .neo-mono {
          font-family: 'Courier Prime', monospace !important;
        }

        /* Range input styling */
        .neo-archive-root input[type="range"] {
          -webkit-appearance: none;
          width: 100%;
          height: 4px !important;
          background: var(--text-primary) !important;
          outline: none;
          cursor: pointer;
          border-radius: 0px !important;
        }

        .neo-archive-root input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 4px;
          height: 18px;
          background-color: var(--text-primary) !important;
          cursor: pointer;
          border: none;
          border-radius: 0px !important;
          transition: background-color 0.1s ease;
        }

        .neo-archive-root input[type="range"]::-webkit-slider-thumb:hover {
          background-color: #991B1B !important;
        }

        /* Flat Buttons */
        .neo-archive-root .neo-btn {
          background-color: var(--bg-surface) !important;
          color: var(--text-primary) !important;
          border: 1.5px solid var(--border-default) !important;
          font-family: 'Outfit', sans-serif !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          border-radius: 0px !important;
          padding: 10px 24px !important;
          height: 44px !important;
          transition: background-color 0.1s ease, color 0.1s ease !important;
        }

        .neo-archive-root .neo-btn:hover:not(:disabled) {
          background-color: var(--primary) !important;
          color: var(--bg-surface) !important;
        }

        .neo-archive-root .neo-btn-primary {
          border: 2px solid var(--border-default) !important;
        }

        .neo-archive-root .neo-btn-destructive {
          border: 1.5px solid #991B1B !important;
          color: #991B1B !important;
          background-color: transparent !important;
        }

        .neo-archive-root .neo-btn-destructive:hover:not(:disabled) {
          background-color: #991B1B !important;
          color: white !important;
        }

        /* Custom Checkbox */
        .neo-archive-root input[type="checkbox"] {
          -webkit-appearance: none;
          appearance: none;
          width: 18px !important;
          height: 18px !important;
          border: 1px solid var(--border-default) !important;
          background-color: var(--bg-surface) !important;
          cursor: pointer;
          position: relative;
        }

        .neo-archive-root input[type="checkbox"]:checked::after {
          content: '✓';
          position: absolute;
          top: -2px;
          left: 3px;
          font-size: 12px !important;
          font-weight: bold;
          color: var(--text-primary);
        }

        /* Custom Switch Overrides */
        .neo-archive-root button[role="switch"] {
          border-radius: 0px !important;
          border: 1.5px solid var(--border-default) !important;
          height: 22px !important;
          width: 40px !important;
          padding: 0 !important;
          background-color: var(--bg-surface) !important;
        }

        .neo-archive-root button[role="switch"][data-state="checked"] {
          background-color: var(--primary) !important;
        }

        .neo-archive-root button[role="switch"] span[data-state] {
          border-radius: 0px !important;
          height: 16px !important;
          width: 16px !important;
          background-color: var(--primary) !important;
          transform: translateX(1px) !important;
          transition: transform 0.1s ease !important;
        }

        .neo-archive-root button[role="switch"][data-state="checked"] span[data-state] {
          background-color: var(--bg-surface) !important;
          transform: translateX(19px) !important;
        }

        /* Custom Input & Select Box styling */
        .neo-archive-root select,
        .neo-archive-root input[type="text"] {
          background-color: var(--bg-surface) !important;
          color: var(--text-primary) !important;
          border: 1.5px solid var(--border-default) !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 15px !important;
          padding: 10px 14px !important;
          height: 44px !important;
          border-radius: 0px !important;
          outline: none !important;
        }

        /* Ledger description card styles */
        .neo-ledger-card {
          background-image: repeating-linear-gradient(
            to bottom,
            transparent,
            transparent 23px,
            rgba(30, 30, 30, 0.12) 23px,
            rgba(30, 30, 30, 0.12) 24px
          ) !important;
          background-color: var(--bg-surface) !important;
          line-height: 24px !important;
        }
      ` }} />
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center border-b border-[#1E1E1E]/80 pb-6">
          <h1 className="text-4xl md:text-5xl font-black mb-2 text-[#1E1E1E] uppercase tracking-wide font-serif">
            LED Matrix Project
          </h1>
          <p className="text-[#5E5E5E] text-sm md:text-base max-w-md mx-auto italic lowercase font-sans-display">
            480 led physical computing display (24x20) with audio capabilities
          </p>
        </header>

        {/* Global Controls Banner */}
        <div className="mb-6 p-4 bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Sliders className="w-5 h-5 text-[#1E1E1E]" />
            <div>
              <span className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] block">
                Matrix Hardware Brightness
              </span>
              <span className="text-xs text-[#5E5E5E] font-serif block">
                Adjust the overall physical light output scaling factor
              </span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto">
            <div className="flex items-center gap-4 w-full sm:w-64">
              <input
                type="range"
                min="0"
                max="255"
                step="5"
                value={globalBrightness}
                onChange={(e) => handleUpdateBrightness(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="font-mono text-sm font-bold text-[#1E1E1E] min-w-[3rem] text-right">
                {Math.round((globalBrightness / 255) * 100)}%
              </span>
            </div>
            
            <MatrixButton
              actionKey="stop_matrix"
              actionStates={actionStates}
              onClick={handleStopAll}
              variant="outline"
              className="w-full sm:w-auto bg-transparent border border-[#1E1E1E]/40 hover:bg-[#1E1E1E]/10 text-[#1E1E1E] hover:text-[#1E1E1E] active:bg-[#1E1E1E]/20 active:text-[#1E1E1E] rounded-none uppercase font-bold tracking-wider font-sans-display h-10 px-6 whitespace-nowrap"
              defaultText="Stop Matrix"
              loadingText="Stopping..."
              successText="Stopped"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList 
            className="flex flex-col items-stretch sm:grid sm:grid-cols-4 w-full max-w-5xl mx-auto mb-8 bg-[#1E1E1E] border border-[#1E1E1E] rounded-none p-0 h-auto gap-[1px]"
            onKeyDown={(e) => {
              if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <TabsTrigger
              value="search"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <Search className="w-4 h-4 shrink-0" />
              Searches
            </TabsTrigger>
            <TabsTrigger
              value="sorts"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              Sorts
            </TabsTrigger>
            <TabsTrigger
              value="songs"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <Music className="w-4 h-4 shrink-0" />
              Music
            </TabsTrigger>
            <TabsTrigger
              value="image"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              Images
            </TabsTrigger>
            <TabsTrigger
              value="glyphs"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <FileText className="w-4 h-4 shrink-0" />
              Text
            </TabsTrigger>
            <TabsTrigger
              value="game"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => {
                const target = e.currentTarget;
                setTimeout(() => {
                  target.blur();
                }, 50);
              }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <Play className="w-4 h-4 shrink-0" />
              Playground
            </TabsTrigger>
            <TabsTrigger
              value="math"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Arithmetic
            </TabsTrigger>
            <TabsTrigger
              value="pathfinding"
              onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="flex items-center justify-center gap-1.5 py-4 px-1 sm:px-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:text-sm bg-[#FDFBF7] text-[#1E1E1E] border-none data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-[#FDFBF7] hover:bg-[#EFE6CD] data-[state=active]:hover:bg-[#1E1E1E] data-[state=active]:hover:text-[#FDFBF7] rounded-none transition-colors duration-100"
            >
              <Route className="w-4 h-4 shrink-0" />
              Pathfinding
            </TabsTrigger>
          </TabsList>          {/* ==================== INFO TAB ==================== */}
          <TabsContent value="search" className="space-y-6 focus-visible:outline-none">
            {/* Status Panel Card */}
            <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
              <CardHeader className="pb-4 border-b border-[#1E1E1E]/20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl text-[#1E1E1E] font-serif font-bold flex items-center gap-2">
                      <Search className="w-6 h-6 text-[#1E1E1E]" />
                      Search Algorithms
                    </CardTitle>
                    <CardDescription className="text-[#5E5E5E] mt-1 font-sans-display text-xs italic lowercase">
                      dispatch search visualisations to the physical display
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-[#1E1E1E] pt-4 bg-[#FDFBF7]">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-3">Algorithm</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setSearchAlgorithm("linear_search")}
                          className={`rounded-none border-[#1E1E1E]/40 ${searchAlgorithm === "linear_search" ? "bg-[#1E1E1E] text-[#FDFBF7]" : "hover:bg-[#1E1E1E] hover:text-[#FDFBF7]"}`}>
                          Linear Search
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setSearchAlgorithm("binary_search")}
                          className={`rounded-none border-[#1E1E1E]/40 ${searchAlgorithm === "binary_search" ? "bg-[#1E1E1E] text-[#FDFBF7]" : "hover:bg-[#1E1E1E] hover:text-[#FDFBF7]"}`}>
                          Binary Search
                        </Button>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-3">Scenario (Time Complexity)</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setSearchScenario("best")}
                          className={`rounded-none border-[#1E1E1E]/40 text-xs ${searchScenario === "best" ? "bg-[#1E1E1E] text-[#FDFBF7]" : "hover:bg-[#1E1E1E] hover:text-[#FDFBF7]"}`}>
                          Best
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setSearchScenario("average")}
                          className={`rounded-none border-[#1E1E1E]/40 text-xs ${searchScenario === "average" ? "bg-[#1E1E1E] text-[#FDFBF7]" : "hover:bg-[#1E1E1E] hover:text-[#FDFBF7]"}`}>
                          Average
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setSearchScenario("worst")}
                          className={`rounded-none border-[#1E1E1E]/40 text-xs ${searchScenario === "worst" ? "bg-[#1E1E1E] text-[#FDFBF7]" : "hover:bg-[#1E1E1E] hover:text-[#FDFBF7]"}`}>
                          Worst
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Global Delay Slider */}
                    <div className="border border-[#1E1E1E]/40 bg-[#FDFBF7] p-3 rounded-none space-y-1">
                      <div className="flex justify-between text-xs font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                        <span>Delay: {globalSortSpeed}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="1.0"
                        step="0.01"
                        value={globalSortSpeed}
                        onChange={(e) => setGlobalSortSpeed(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Global Volume Slider */}
                    <div className="border border-[#1E1E1E]/40 bg-[#FDFBF7] p-3 rounded-none space-y-1 flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                          <span>Volume: {globalSortSound ? `${globalSortVolume}%` : "Muted"}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={globalSortVolume}
                          onChange={(e) => setGlobalSortVolume(parseInt(e.target.value))}
                          disabled={!globalSortSound}
                          className="w-full"
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1 border-l border-[#1E1E1E]/20 pl-4">
                        <Switch
                          checked={globalSortSound}
                          onCheckedChange={setGlobalSortSound}
                          id="search-sound-toggle"
                          className="neo-switch"
                        />
                        <label htmlFor="search-sound-toggle" className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E] cursor-pointer select-none">
                          Sound
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button 
                    className="w-full neo-btn h-12 font-bold tracking-widest uppercase"
                    onClick={() => {
                      handleTriggerAlgo({ id: searchAlgorithm, name: searchAlgorithm.replace('_', ' '), description: "", icon: Search, color: "" });
                    }}
                  >
                    Run
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CONTROLS TAB ==================== */}
          <TabsContent value="sorts" className="space-y-6 focus-visible:outline-none">
            {/* Status Panel Card */}
            <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
              <CardHeader className="pb-4 border-b border-[#1E1E1E]/20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl text-[#1E1E1E] font-serif font-bold flex items-center gap-2">
                      <Activity className="w-6 h-6 text-[#1E1E1E]" />
                      Active Matrix Console
                    </CardTitle>
                    <CardDescription className="text-[#5E5E5E] mt-1 font-sans-display text-xs italic lowercase">
                      dispatch live visual and audio algorithms to the physical display
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 border border-[#991B1B] bg-transparent px-3 py-1.5 rounded-none self-start sm:self-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-[#991B1B] opacity-75"></span>
                      <span className="relative inline-flex rounded-none h-2 w-2 bg-[#991B1B]"></span>
                    </span>
                    <span className="text-[10px] font-bold text-[#991B1B] uppercase tracking-wider font-mono">
                      STATUS: LIVE
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-[#1E1E1E] pt-4 bg-[#FDFBF7]">
                <p className="text-xs leading-relaxed text-[#5E5E5E]">
                  <strong className="text-[#1E1E1E] uppercase font-bold">Visual Warning:</strong> Sending an algorithm will immediately override the current output of the matrix. Auditory frequencies are synced to swaps and comparisons dynamically.
                </p>
                {activeAlgo && activeAlgo !== "idle" && activeAlgo !== "shutdown" && (
                  <div className="mt-3 flex items-center justify-between border border-[#1E1E1E]/40 bg-[#FDFBF7] p-2.5 text-xs text-[#1E1E1E] rounded-none">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-sans-display text-[10px] uppercase tracking-wider text-[#5E5E5E]">Current Pattern:</span>
                      <span className="capitalize px-2 py-0.5 bg-[#FDFBF7] border border-[#1E1E1E]/60 text-xs font-mono font-bold text-[#1E1E1E]">
                        {activeAlgo}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleTriggerAlgo({ id: "idle", name: "Idle Mode", description: "", icon: Clock, color: "" })}
                      className="neo-btn neo-btn-destructive h-7 px-3 text-[10px] flex items-center gap-1.5"
                    >
                      <Power className="w-3.5 h-3.5" />
                      Stop Pattern
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Array State Constructor */}
            <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
              <CardHeader className="pb-4 border-b border-[#1E1E1E]/20">
                <CardTitle className="text-lg text-[#1E1E1E] font-serif font-bold flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#1E1E1E]" />
                  Dataset Configuration
                </CardTitle>
                <CardDescription className="text-[#5E5E5E] mt-0.5 text-xs font-mono lowercase">
                  generate a preset pattern or draw custom values using the sliders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4 bg-[#FDFBF7]">
                {/* Preset Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      generateRandomSortArray();
                      setPresetSelected("random");
                    }}
                    className={`neo-btn text-xs py-1.5 px-3 h-auto flex items-center gap-2 ${
                      presetSelected === "random" ? "neo-btn-active bg-[#1E1E1E] text-[#FDFBF7]" : "neo-btn-primary"
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5 shrink-0" />
                    Random starting state
                  </Button>
                  <Button
                    onClick={() => {
                      generateReverseSortArray();
                      setPresetSelected("reverse");
                    }}
                    className={`neo-btn text-xs py-1.5 px-3 h-auto flex items-center gap-2 ${
                      presetSelected === "reverse" ? "neo-btn-active bg-[#1E1E1E] text-[#FDFBF7]" : "neo-btn-primary"
                    }`}
                  >
                    <ArrowDownNarrowWide className="w-3.5 h-3.5 shrink-0" />
                    Reverse order
                  </Button>
                  <Button
                    onClick={() => {
                      generateNearlySortedSortArray();
                      setPresetSelected("nearly_sorted");
                    }}
                    className={`neo-btn text-xs py-1.5 px-3 h-auto flex items-center gap-2 ${
                      presetSelected === "nearly_sorted" ? "neo-btn-active bg-[#1E1E1E] text-[#FDFBF7]" : "neo-btn-primary"
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                    Nearly sorted
                  </Button>
                </div>

                {/* Tactile Equalizer Sliders */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                    <span>Interactive Array Editor</span>
                    <span className="font-mono">{sortArray.length} items</span>
                  </div>
                  <div className="flex items-end justify-between gap-1 h-36 bg-[#1E1E1E] p-4 border border-[#1E1E1E]">
                    {sortArray.map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        {/* Hidden native vertical slider */}
                        <input
                          type="range"
                          min="0"
                          max="23"
                          value={val}
                          onChange={(e) => {
                            const newVal = parseInt(e.target.value);
                            const updated = [...sortArray];
                            updated[idx] = newVal;
                            setSortArray(updated);
                            syncSortArrayToMatrix(updated);
                            setPresetSelected("custom");
                          }}
                          className="w-full h-full cursor-ns-resize opacity-0 absolute top-0 left-0 z-10"
                          style={{ writingMode: "vertical-lr", WebkitAppearance: "slider-vertical" } as any}
                        />
                        {/* Visual Bar representation */}
                        <div 
                          className="w-full bg-[#EFE6CD] group-hover:bg-[#EFE6CD]/80 transition-colors pointer-events-none"
                          style={{ height: `${(val / 23) * 100}%` }}
                        />
                        {/* Label on hover */}
                        <span className="absolute -bottom-6 text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity text-[#1E1E1E] font-bold bg-[#FDFBF7] px-1 border border-[#1E1E1E] z-20">
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comma-separated Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E] block">
                    Direct CSV Editor
                  </label>
                  <input
                    type="text"
                    value={csvInputValue}
                    onChange={(e) => {
                      const textVal = e.target.value;
                      setCsvInputValue(textVal);

                      const values = textVal
                        .split(",")
                        .map((v) => parseInt(v.trim()))
                        .filter((v) => !isNaN(v));

                      if (values.length === 20 && !values.some((v) => v < 0 || v > 23)) {
                        setSortArray(values);
                        syncSortArrayToMatrix(values);
                        setPresetSelected("custom");
                      }
                    }}
                    placeholder="Enter 20 values between 0 and 23..."
                    className="w-full bg-[#FDFBF7] border border-[#1E1E1E]/60 text-[#1E1E1E] font-mono text-xs px-3 py-2 focus:border-[#1E1E1E] focus:outline-none rounded-none"
                  />
                  <p className="text-[10px] text-[#5E5E5E] italic">
                    Note: Direct CSV values will update the matrix once exactly 20 integers are entered.
                  </p>
                </div>

                {/* Global Settings Block */}
                <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-[#1E1E1E]/20 mt-4">
                  {/* Global Sound Switch */}
                  <div className="flex items-center gap-2 border border-[#1E1E1E]/40 bg-[#FDFBF7] p-3 rounded-none">
                    <Switch
                      checked={globalSortSound}
                      onCheckedChange={setGlobalSortSound}
                      id="global-sort-sound"
                      className="neo-switch"
                    />
                    <label htmlFor="global-sort-sound" className="text-xs font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E] cursor-pointer select-none">
                      Sound Feedback
                    </label>
                  </div>

                  {/* Global Delay Slider */}
                  <div className="border border-[#1E1E1E]/40 bg-[#FDFBF7] p-3 rounded-none space-y-1">
                    <div className="flex justify-between text-xs font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                      <span>Delay: {globalSortSpeed}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="1.0"
                      step="0.01"
                      value={globalSortSpeed}
                      onChange={(e) => setGlobalSortSpeed(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* Global Volume Slider */}
                  <div className="border border-[#1E1E1E]/40 bg-[#FDFBF7] p-3 rounded-none space-y-1">
                    <div className="flex justify-between text-xs font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                      <span>Volume: {globalSortSound ? `${globalSortVolume}%` : "Muted"}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={globalSortVolume}
                      onChange={(e) => setGlobalSortVolume(parseInt(e.target.value))}
                      disabled={!globalSortSound}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sorting Visualisations */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-serif text-[#1E1E1E] px-1 flex items-center gap-2 mt-6">
                <ArrowUpDown className="w-5 h-5 text-[#1E1E1E]" />
                Sorting Visualisations
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {sortingAlgos.map((algo) => {
                  const Icon = algo.icon;
                  const isCurrent = activeAlgo === algo.id;
                  const isLoading = loadingAlgo === algo.id;
                  const isAnyLoading = loadingAlgo !== null;

                  return (
                    <Card 
                      key={algo.id}
                      className={`transition-all duration-100 border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none hover:border-[#1E1E1E] ${
                        isCurrent ? "border-2 border-[#1E1E1E]" : ""
                      }`}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-2 h-full">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Icon Box */}
                          <div className="p-2 border border-[#1E1E1E] text-[#1E1E1E] bg-[#FDFBF7] rounded-none shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          {/* Title and Badge */}
                          <div className="flex items-center gap-2 truncate">
                            <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] whitespace-nowrap truncate">
                              {algo.name}
                            </h3>
                            {algo.badge && (
                              <span className="text-[8px] font-bold uppercase tracking-wider bg-[#1E1E1E] text-[#FDFBF7] px-1.5 py-0.5 border border-[#1E1E1E] font-mono shrink-0">
                                {algo.badge}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Trigger Button */}
                        <MatrixButton
                          actionKey={algo.id}
                          actionStates={actionStates}
                          onClick={() => handleTriggerAlgo(algo)}
                          disabled={isAnyLoading}
                          className={`w-20 shrink-0 neo-btn h-8 text-[10px] font-bold uppercase tracking-wider ${
                            isCurrent 
                              ? "bg-[#1E1E1E] text-[#FDFBF7] border border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" 
                              : "bg-[#FDFBF7] text-[#1E1E1E] border border-[#1E1E1E]/40 hover:bg-[#EFE6CD]"
                          }`}
                          defaultText={isCurrent ? "Active" : "Run"}
                          loadingText="..."
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* System Commands */}
            <div className="space-y-4 pt-4">
              <h2 className="text-xl font-bold font-serif text-[#1E1E1E] px-1 flex items-center gap-2 mt-6">
                <Power className="w-5 h-5 text-[#1E1E1E]" />
                System Operations
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {systemCmds.map((cmd) => {
                  const Icon = cmd.icon;
                  const isAnyLoading = loadingAlgo !== null;

                  return (
                    <Card 
                      key={cmd.id}
                      className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none"
                    >
                      <CardContent className="p-5 flex flex-col justify-between h-full min-h-[140px]">
                        <div>
                          <div className="flex items-center gap-3 mb-2.5">
                            <div className="p-2 border border-[#1E1E1E] text-[#1E1E1E] bg-[#FDFBF7] rounded-none">
                              <Icon className="w-4 h-4" />
                            </div>
                            <h3 className="font-bold font-sans-display text-sm uppercase tracking-wider text-[#1E1E1E]">
                              {cmd.name}
                            </h3>
                          </div>
                          <p className="text-[#5E5E5E] text-xs leading-relaxed">
                            {cmd.description}
                          </p>
                        </div>
                        <div className="mt-4">
                          <MatrixButton
                            actionKey={cmd.id}
                            actionStates={actionStates}
                            onClick={() => handleTriggerAlgo(cmd)}
                            disabled={isAnyLoading}
                            className={`w-full neo-btn h-9 text-[10px] font-bold uppercase tracking-wider ${
                              cmd.id === "shutdown" 
                                ? "neo-btn-destructive" 
                                : "bg-[#FDFBF7] text-[#1E1E1E] border border-[#1E1E1E]/40 hover:bg-[#EFE6CD]"
                            }`}
                            defaultText={cmd.name}
                            loadingText="Processing..."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ==================== SONGS TAB ==================== */}
          <TabsContent value="songs" className="space-y-6 focus-visible:outline-none">
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-serif text-[#1E1E1E] px-1 flex items-center gap-2 mt-6">
                <Music className="w-5 h-5 text-[#1E1E1E]" />
                Music Library
              </h2>

              {/* Controls row */}
              <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold font-sans-display text-sm uppercase tracking-wider text-[#1E1E1E]">
                      {activeAlgo === "navidrome_album" && matrixState.song_id ? (
                        (() => {
                          const currentTrack = activeAlbumTracks.find((t) => t.id === matrixState.song_id);
                          return currentTrack ? currentTrack.title : "Playing Album...";
                        })()
                      ) : (
                        "Playback Controls"
                      )}
                    </h3>
                    <p className="text-[#5E5E5E] text-xs leading-relaxed max-w-xl mt-1 font-serif italic truncate">
                      {activeAlgo === "navidrome_album" && matrixState.song_id ? (
                        (() => {
                          const currentTrack = activeAlbumTracks.find((t) => t.id === matrixState.song_id);
                          return currentTrack ? currentTrack.artist : "Adjust volume or stop active playback.";
                        })()
                      ) : (
                        "Adjust volume or stop active playback on the LED matrix."
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-[#1E1E1E]/20">
                    <div className="flex items-center gap-2 bg-[#FDFBF7] px-2.5 py-1.5 rounded-none border border-stone-300 w-full sm:w-auto justify-between sm:justify-start">
                      <span className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                        Visualiser:
                      </span>
                      <select
                        className="bg-transparent text-xs font-serif outline-none text-[#1E1E1E] cursor-pointer"
                        value={visMode}
                        onChange={async (e) => {
                          const newMode = e.target.value;
                          setVisMode(newMode);
                          if (activeAlgo === "navidrome_album" || activeAlgo === "navidrome" || activeAlgo === "song") {
                            try {
                              let pixels = undefined;
                              if (newMode === "artwork" && activeSongId) {
                                const track = activeAlbumTracks.find(t => t.id === activeSongId) || 
                                              musicResults.find(t => t.id === activeSongId);
                                if (track && track.coverArt) {
                                  pixels = await extractArtworkPixels(track.coverArt) || undefined;
                                }
                              }
                              await fetch("/api/matrix", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ algo: "set_vis_mode", vis_mode: newMode, artwork_pixels: pixels }),
                              });
                            } catch (err) {
                              console.error("Failed to update visualizer:", err);
                            }
                          }
                        }}
                      >
                        <option value="loop">Loop All</option>
                        <option value="artwork">Album Artwork</option>
                        <option value="0">Equalizer</option>
                        <option value="1">Ripple Waves</option>
                        <option value="2">Plasma</option>
                        <option value="3">Fire & Flame</option>
                        <option value="4">Stardust</option>
                        <option value="5">Diagonal Wash</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-[#FDFBF7] px-2.5 py-1.5 rounded-none border border-stone-300 w-full sm:w-auto justify-between sm:justify-start">
                      <span className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                        Vol: {songVolume}%
                      </span>
                      <input
                        type="range" min="0" max="100" step="10"
                        value={songVolume}
                        onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                        className="w-24 sm:w-20"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                      <Button
                        onClick={async () => {
                          setLoadingAlgo("idle");
                          try {
                            await fetch("/api/matrix", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ algo: "idle" }),
                            });
                            setActiveAlgo(null);
                            setActiveSongId(null);
                            setIsMusicPaused(false);
                          } catch (err) {
                            console.error("Failed to stop song:", err);
                          } finally {
                            setLoadingAlgo(null);
                          }
                        }}
                        disabled={loadingAlgo !== null}
                        className="neo-btn neo-btn-primary px-3 h-10 w-12 flex items-center justify-center active:scale-95 transition-transform"
                        title="Stop Playback"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </Button>
                      {(activeAlgo === "navidrome" || activeAlgo === "song" || activeAlgo === "navidrome_album") && (
                        <div className="flex items-center gap-2">
                          {activeAlgo === "navidrome_album" && (
                            <Button
                            onClick={async () => {
                              try {
                                await fetch("/api/matrix", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ algo: "prev" }),
                                });
                              } catch (err) {
                                console.error("Failed to skip to previous track:", err);
                              }
                            }}
                            disabled={loadingAlgo !== null}
                            className="neo-btn neo-btn-primary px-3 active:scale-95 transition-transform"
                            title="Previous Track"
                          >
                            <SkipBack className="w-5 h-5 fill-current" />
                          </Button>
                        )}
                        
                        <Button
                          onClick={async () => {
                            const nextPauseState = !isMusicPaused;
                            setLoadingAlgo(nextPauseState ? "pause" : "resume");
                            try {
                              await fetch("/api/matrix", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ algo: nextPauseState ? "pause" : "resume" }),
                              });
                              setIsMusicPaused(nextPauseState);
                            } catch (err) {
                              console.error("Failed to pause/resume song:", err);
                            } finally {
                              setLoadingAlgo(null);
                            }
                          }}
                          disabled={loadingAlgo !== null}
                          className="neo-btn neo-btn-primary px-4 active:scale-95 transition-transform"
                          title={isMusicPaused ? "Resume" : "Pause"}
                        >
                          {isMusicPaused ? (
                            <Play className="w-6 h-6 fill-current" />
                          ) : (
                            <Pause className="w-6 h-6 fill-current" />
                          )}
                        </Button>
                        
                        {activeAlgo === "navidrome_album" && (
                          <Button
                            onClick={async () => {
                              try {
                                await fetch("/api/matrix", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ algo: "next" }),
                                });
                              } catch (err) {
                                console.error("Failed to skip to next track:", err);
                              }
                            }}
                            disabled={loadingAlgo !== null}
                            className="neo-btn neo-btn-primary px-3 active:scale-95 transition-transform"
                            title="Next Track"
                          >
                            <SkipForward className="w-5 h-5 fill-current" />
                          </Button>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                </CardContent>
                {activeAlgo === "navidrome_album" && activeAlbumTracks.length > 0 && (
                  <div className="border-t border-[#1E1E1E]/20 bg-[#FDFBF7]/50 divide-y divide-[#1E1E1E]/10 max-h-[300px] overflow-y-auto">
                    {activeAlbumTracks.map((track, idx) => {
                      const isTrackPlaying = matrixState.song_id === track.id;
                      return (
                        <div 
                          key={track.id} 
                          className={`flex items-center gap-3 p-3 text-xs font-serif transition-colors ${
                            isTrackPlaying ? "bg-[#1E1E1E] font-bold text-[#FDFBF7]" : "text-[#5E5E5E] hover:bg-black/5"
                          }`}
                        >
                          <div className={`w-4 text-right text-[10px] font-sans ${isTrackPlaying ? "opacity-100" : "opacity-50"}`}>{idx + 1}</div>
                          <div className="flex-1 truncate">{track.title}</div>
                          {isTrackPlaying && (
                            <div className="shrink-0 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2"></div>
                              <Play className="w-3 h-3 fill-current text-[#FDFBF7]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Search bar */}
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search your music library... (min. 3 characters)"
                  value={musicQuery}
                  onChange={(e) => setMusicQuery(e.target.value)}
                  className="w-full border border-[#1E1E1E]/60 bg-[#FDFBF7] px-4 py-3 pr-10 text-sm font-serif text-[#1E1E1E] placeholder:text-[#5E5E5E]/60 focus:outline-none focus:border-[#1E1E1E] rounded-none"
                />
                {musicLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1E1E1E] animate-spin" />
                )}
              </div>

              {/* Error state */}
              {musicError && (
                <div className="flex items-center gap-2 px-4 py-3 border border-red-300 bg-red-50 text-red-700 text-xs font-serif">
                  <span className="font-bold uppercase tracking-wide">Error:</span> {musicError}
                </div>
              )}

              {/* Prompt state — nothing typed yet */}
              {!musicError && musicQuery.trim().length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#1E1E1E]/30 bg-[#FDFBF7] text-center">
                  <Music className="w-10 h-10 text-[#5E5E5E] mb-3" />
                  <p className="text-sm font-bold text-[#1E1E1E] uppercase tracking-wide">Search Your Library</p>
                  <p className="text-xs text-[#5E5E5E] mt-1 max-w-xs font-serif">
                    Type an artist, song, or album name to find tracks from your library.
                  </p>
                </div>
              )}

              {/* Too-short query hint */}
              {!musicError && musicQuery.trim().length > 0 && musicQuery.trim().length < 3 && (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-[#1E1E1E]/30 bg-[#FDFBF7] text-center">
                  <p className="text-xs text-[#5E5E5E] font-serif">Keep typing... ({3 - musicQuery.trim().length} more character{3 - musicQuery.trim().length !== 1 ? "s" : ""})</p>
                </div>
              )}

              {/* No results */}
              {!musicError && !musicLoading && musicQuery.trim().length >= 3 && musicResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-[#1E1E1E]/40 bg-[#FDFBF7] text-center p-6">
                  <Music className="w-10 h-10 text-[#5E5E5E] mb-2" />
                  <p className="text-sm font-bold text-[#1E1E1E] uppercase tracking-wide">No Results</p>
                  <p className="text-xs text-[#5E5E5E] mt-1 font-serif">No tracks found for &ldquo;{musicQuery}&rdquo;</p>
                </div>
              )}

              {/* Results grid */}
              {musicAlbums.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold font-sans-display text-sm uppercase tracking-wider text-[#1E1E1E] mb-3">Albums</h3>
                  <div className={`grid gap-3 ${activeAlgo === "navidrome_album" && activeSongId ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
                    {musicAlbums
                      .filter(album => (activeAlgo === "navidrome_album" && activeSongId) ? activeSongId === album.id : true)
                      .map((album) => {
                      const isCurrent = activeAlgo === "navidrome_album" && activeSongId === album.id;
                      const isAnyLoading = loadingAlgo !== null;

                      return (
                        <Card
                          key={album.id}
                          className={`transition-all duration-300 border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none hover:border-[#1E1E1E] ${
                            isCurrent ? "border-2 border-[#1E1E1E]" : ""
                          }`}
                        >
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Album art */}
                              {album.coverArt ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`/api/navidrome/art?id=${album.coverArt}&size=80`}
                                  alt={album.title}
                                  className="w-12 h-12 object-cover border border-[#1E1E1E]/30 shrink-0"
                                />
                              ) : (
                                <div className={`w-12 h-12 flex items-center justify-center border border-[#1E1E1E] shrink-0 ${
                                  isCurrent ? "bg-[#1E1E1E] text-[#FDFBF7]" : "bg-[#FDFBF7] text-[#1E1E1E]"
                                }`}>
                                  <Music className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] truncate">
                                  {album.title}
                                </h3>
                                <p className="text-[10px] text-[#5E5E5E] font-serif mt-0.5 truncate">
                                  {album.artist}
                                </p>
                                <p className="text-[10px] text-[#5E5E5E]/70 font-serif truncate">
                                  {album.songCount} tracks
                                </p>
                              </div>
                            </div>
                            <Button
                              onClick={async () => {
                                setLoadingAlgo("navidrome");
                                setLoadingSongId(album.id);
                                try {
                                  // Fetch album tracklist
                                  const trackRes = await fetch(`/api/navidrome/album?id=${album.id}`);
                                  const trackData = await trackRes.json();
                                  if (trackData.song_ids && trackData.song_ids.length > 0) {
                                    if (trackData.songs) {
                                      setActiveAlbumTracks(trackData.songs);
                                    }
                                    await fetch("/api/matrix", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        algo: "navidrome",
                                        song_ids: trackData.song_ids,
                                        volume: songVolume / 100,
                                        vis_mode: visMode,
                                        artwork_pixels: visMode === "artwork" && album.coverArt ? await extractArtworkPixels(album.coverArt) || undefined : undefined,
                                      }),
                                    });
                                    setActiveAlgo("navidrome_album");
                                    setActiveSongId(album.id);
                                    setIsMusicPaused(false);
                                  }
                                } catch (e) {
                                  console.error("Failed to trigger album:", e);
                                } finally {
                                  setLoadingAlgo(null);
                                  setLoadingSongId(null);
                                }
                              }}
                              disabled={isAnyLoading}
                              className={`neo-btn px-4 text-xs h-9 min-w-[90px] shrink-0 ${
                                isCurrent ? "neo-btn-active bg-[#1E1E1E] text-[#FDFBF7]" : "neo-btn-primary"
                              }`}
                            >
                              {isCurrent ? "PLAYING" : "PLAY"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {musicResults.length > 0 && (
                <div>
                  {musicAlbums.length > 0 && (
                    <h3 className="font-bold font-sans-display text-sm uppercase tracking-wider text-[#1E1E1E] mb-3">Tracks</h3>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                  {musicResults.map((track) => {
                    const isCurrent = activeAlgo === "navidrome" && activeSongId === track.id;
                    const isAnyLoading = loadingAlgo !== null;
                    const durationMin = Math.floor(track.duration / 60);
                    const durationSec = String(track.duration % 60).padStart(2, "0");

                    return (
                      <Card
                        key={track.id}
                        className={`transition-all duration-100 border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none hover:border-[#1E1E1E] ${
                          isCurrent ? "border-2 border-[#1E1E1E]" : ""
                        }`}
                      >
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Album art */}
                            {track.coverArt ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/navidrome/art?id=${track.coverArt}&size=80`}
                                alt={track.album}
                                className="w-12 h-12 object-cover border border-[#1E1E1E]/30 shrink-0"
                              />
                            ) : (
                              <div className={`w-12 h-12 flex items-center justify-center border border-[#1E1E1E] shrink-0 ${
                                isCurrent ? "bg-[#1E1E1E] text-[#FDFBF7]" : "bg-[#FDFBF7] text-[#1E1E1E]"
                              }`}>
                                <Music className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] truncate">
                                {track.title}
                              </h3>
                              <p className="text-[10px] text-[#5E5E5E] font-serif mt-0.5 truncate">
                                {track.artist}
                              </p>
                              <p className="text-[10px] text-[#5E5E5E]/70 font-serif truncate">
                                {track.album} &middot; {durationMin}:{durationSec}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={async () => {
                              setLoadingAlgo("navidrome");
                              setLoadingSongId(track.id);
                              try {
                                await fetch("/api/matrix", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    algo: "navidrome",
                                    song_id: track.id,
                                    volume: songVolume / 100,
                                    vis_mode: visMode,
                                    artwork_pixels: visMode === "artwork" && track.coverArt ? await extractArtworkPixels(track.coverArt) || undefined : undefined,
                                  }),
                                });
                                setActiveAlgo("navidrome");
                                setActiveSongId(track.id);
                                setIsMusicPaused(false);
                              } catch (e) {
                                console.error("Failed to trigger track:", e);
                              } finally {
                                setLoadingAlgo(null);
                                setLoadingSongId(null);
                              }
                            }}
                            disabled={isAnyLoading}
                            className={`neo-btn px-4 text-xs h-9 min-w-[90px] shrink-0 ${
                              isCurrent ? "neo-btn-active bg-[#1E1E1E] text-[#FDFBF7]" : "neo-btn-primary"
                            }`}
                          >
                            {isCurrent ? "✓ PLAYING" : "PLAY"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          </TabsContent>

          {/* ==================== IMAGE DISPLAY TAB ==================== */}
          <TabsContent value="image" className="space-y-6 focus-visible:outline-none">
            {/* Image Upload & Pixelator */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-serif text-[#1E1E1E] px-1 flex items-center gap-2 mt-6">
                <ImageIcon className="w-5 h-5 text-[#1E1E1E]" />
                Image Display
              </h2>
              <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                <CardContent className="p-5 flex flex-col md:flex-row gap-6">
                  {/* Left sub-column: File input & Scaling settings */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="font-bold font-sans-display text-sm uppercase tracking-wider text-[#1E1E1E]">Upload Photo</h3>
                      <p className="text-[#5E5E5E] text-xs mt-1 leading-relaxed">
                        Select a photo from your device. It will be rescaled and averaged into a 20x24 portrait grid.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                      {/* Hidden File Input */}
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        className="hidden" 
                      />
                      
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="neo-btn flex-1 h-10 border-dashed"
                      >
                        <Upload className="w-4 h-4 mr-2 inline" />
                        {fileName ? "Change Image" : "Choose File..."}
                      </Button>

                      {fileName && (
                        <div className="flex items-center px-3 py-2 bg-[#FDFBF7] border border-[#1E1E1E]/40 rounded-none text-xs text-[#1E1E1E] max-w-[200px] truncate">
                          {fileName}
                        </div>
                      )}
                    </div>

                    {fileName && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] block">Fit Mode</span>
                        <div className="grid grid-cols-3 gap-2">
                          {(["cover", "contain", "stretch"] as const).map((mode) => (
                            <Button
                              key={mode}
                              onClick={() => setScaleMode(mode)}
                              className={`neo-btn capitalize text-xs h-8 ${scaleMode === mode ? "bg-[#1E1E1E] text-white" : ""}`}
                            >
                              {mode}
                            </Button>
                          ))}
                        </div>
                        <p className="text-[10px] text-stone-500 font-serif italic">
                          {scaleMode === "cover" && "Cover: Crops the image to fit the 20x24 area perfectly."}
                          {scaleMode === "contain" && "Contain: Scales image inside grid with letterbox borders."}
                          {scaleMode === "stretch" && "Stretch: Forces the image to fit, ignoring aspect ratio."}
                        </p>
                      </div>
                    )}

                    {(imagePixels || gifFrames) && (
                      <MatrixButton
                        actionKey="send_image"
                        actionStates={actionStates}
                        onClick={handleSendImage}
                        className="neo-btn neo-btn-primary w-full h-10 flex items-center justify-center gap-2"
                        defaultText="Send to Matrix"
                        icon={ImageIcon}
                      />
                    )}
                  </div>

                  {/* Right sub-column: 20x24 Pixelated Preview */}
                  {imagePixels && (
                    <div className="w-full md:w-56 flex flex-col items-center justify-center bg-[#FDFBF7] border border-[#1E1E1E]/40 rounded-none p-4">
                      <span className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] mb-3">Pixelated Preview</span>
                      <div 
                        className="grid gap-0.5 border border-[#1E1E1E] p-1 rounded-none bg-stone-900 shadow-none" 
                        style={{ 
                          gridTemplateColumns: "repeat(20, minmax(0, 1fr))",
                          width: "140px"
                        }}
                      >
                        {imagePixels.map((color, idx) => (
                          <div
                            key={idx}
                            className="aspect-square"
                            style={{ 
                              backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                              width: "100%"
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] font-serif italic text-stone-500 mt-3 text-center">Fig. 4. — Spatial downsampling and pixelation preview grid.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== TEXT & GLYPHS TAB ==================== */}
          <TabsContent value="glyphs" className="space-y-6 focus-visible:outline-none">
            <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
              <CardHeader className="pb-4 border-b border-[#1E1E1E]/20">
                <CardTitle className="text-2xl text-[#1E1E1E] font-serif font-bold flex items-center gap-2">
                  <Type className="w-6 h-6 text-[#1E1E1E]" />
                  Text & Typography Display
                </CardTitle>
                <CardDescription className="text-[#5E5E5E] mt-1 font-sans-display text-xs italic lowercase">
                  render custom messages, a real-time clock, or a countdown timer onto the physical grid using pixel typography.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 bg-[#FDFBF7]">
                
                {/* 1. Configuration Grid */}
                <div className="grid sm:grid-cols-2 gap-6 bg-[#FDFBF7] p-4 rounded-none border border-[#1E1E1E]/40">
                  {/* Font Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] block">Font Style</label>
                    <select
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none p-2 text-sm focus:outline-none focus:ring-0 text-[#1E1E1E] font-bold font-sans-display"
                    >
                      <option value="font3x5">Compact 3 × 5 Font</option>
                      <option value="font5x7">Standard 5 × 7 Font</option>
                      <option value="font8x8">Bold 8 × 8 Font</option>
                      <option value="fontplayful">Playful 5 × 7 Font</option>
                    </select>
                  </div>

                  {/* Mode / Scrolling Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] block">Display Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setScrollText(true)}
                        className={`neo-btn text-xs h-9 ${scrollText ? "bg-[#1E1E1E] text-white" : ""}`}
                      >
                        Scrolling Marquee
                      </Button>
                      <Button
                        onClick={() => setScrollText(false)}
                        className={`neo-btn text-xs h-9 ${!scrollText ? "bg-[#1E1E1E] text-white" : ""}`}
                      >
                        Fixed Wrapped
                      </Button>
                    </div>
                  </div>

                  {/* Speed Selector (Only visible if scrolling is enabled) */}
                  {scrollText && (
                    <div className="space-y-1 sm:col-span-2">
                      <div className="flex justify-between text-xs font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E]">
                        <span>Scrolling Speed</span>
                        <span>{scrollSpeed}s delay</span>
                      </div>
                      <input 
                        type="range" min="0.02" max="0.30" step="0.01" 
                        value={scrollSpeed} 
                        onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Custom Message Section */}
                <div className="space-y-4 pt-4 border-t border-[#1E1E1E]/20">
                  <div className="flex items-center text-[#1E1E1E] font-bold font-sans-display text-sm uppercase tracking-wider">
                    <span className="w-2.5 h-4 bg-[#1E1E1E] inline-block mr-2" />
                    Custom Message
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Type your message (A-Z, 0-9)..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      maxLength={100}
                      className="flex-1 bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none px-3.5 py-2.5 text-sm focus:outline-none focus:ring-0 text-[#1E1E1E]"
                    />
                    <select
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-32 bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none p-2 text-sm focus:outline-none focus:ring-0 text-[#1E1E1E] font-bold font-sans-display"
                    >
                      <option value="green">Green</option>
                      <option value="red">Red</option>
                      <option value="blue">Blue</option>
                      <option value="yellow">Yellow</option>
                      <option value="orange">Orange</option>
                      <option value="white">White</option>
                      <option value="cyan">Cyan</option>
                      <option value="magenta">Magenta</option>
                    </select>
                    <MatrixButton
                      actionKey="send_text"
                      actionStates={actionStates}
                      onClick={handleSendText}
                      disabled={loadingAlgo !== null || !customText.trim()}
                      className="neo-btn neo-btn-primary h-10 px-6 font-bold text-xs"
                      defaultText="Send Message"
                      loadingText="Sending..."
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 font-serif italic">
                    Note: Special characters are automatically replaced with spaces.
                  </p>
                </div>

                {/* 3. Utility Widgets Section */}
                <div className="grid sm:grid-cols-2 gap-6 pt-6 border-t border-[#1E1E1E]/20">
                  {/* Clock Widget */}
                  <div className="bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none p-5 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold font-sans-display text-sm uppercase tracking-wider text-[#1E1E1E] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#1E1E1E]" />
                        System Clock Mode
                      </h4>
                      <p className="text-[#5E5E5E] text-xs mt-1.5 leading-relaxed mb-4 font-serif">
                        Pulls the current Raspberry Pi system time and displays it on the matrix. Updates automatically every second.
                      </p>

                      {/* Color Selection */}
                      <div className="space-y-1.5 mb-3">
                        <label className="text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] block">Display Color</label>
                        <select
                          value={clockColor}
                          onChange={(e) => setClockColor(e.target.value)}
                          className="w-full bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none p-1.5 text-xs focus:outline-none focus:ring-0 text-[#1E1E1E] font-bold font-sans-display"
                        >
                          <option value="green">Green</option>
                          <option value="red">Red</option>
                          <option value="blue">Blue</option>
                          <option value="yellow">Yellow</option>
                          <option value="orange">Orange</option>
                          <option value="white">White</option>
                          <option value="cyan">Cyan</option>
                          <option value="magenta">Magenta</option>
                          <option value="multi">Hours Blue / Minutes Green</option>
                        </select>
                      </div>

                      {/* Sound Toggle */}
                      <div className="flex items-center justify-between mb-3 pt-1">
                        <label className="text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">Hourly Chime Sound</label>
                        <input
                          type="checkbox"
                          checked={clockSound}
                          onChange={(e) => setClockSound(e.target.checked)}
                          className="rounded-none border-stone-300 text-emerald-600 focus:ring-0 focus:ring-offset-0"
                        />
                      </div>

                      {/* Volume Control */}
                      {clockSound && (
                        <div className="space-y-1 mb-4">
                          <div className="flex justify-between text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                            <span>Chime Volume</span>
                            <span>{clockVolume}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={clockVolume}
                            onChange={(e) => setClockVolume(parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <MatrixButton
                        actionKey="send_time"
                        actionStates={actionStates}
                        onClick={handleSendTime}
                        disabled={loadingAlgo !== null}
                        className="neo-btn neo-btn-primary w-full text-xs font-bold h-9"
                        defaultText={activeAlgo === "time" ? "Clock Active" : "Display Real-Time Clock"}
                        loadingText="Activating..."
                      />
                    </div>
                  </div>

                  {/* Countdown Timer Widget */}
                  <div className="bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none p-5 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold font-sans-display text-sm uppercase tracking-wider text-[#1E1E1E] flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-[#1E1E1E]" />
                        Countdown Timer
                      </h4>
                      <p className="text-[#5E5E5E] text-xs mt-1.5 leading-relaxed font-serif">
                        Start a countdown timer on the display. The screen will flash red and display &quot;DONE&quot; at completion.
                      </p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {/* Duration Selector */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] block">Duration</label>
                        <select
                          value={countdownSeconds}
                          onChange={(e) => setCountdownSeconds(parseInt(e.target.value))}
                          className="w-full bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none p-1.5 text-xs focus:outline-none focus:ring-0 text-[#1E1E1E] font-bold font-sans-display"
                        >
                          <option value={10}>10 Seconds</option>
                          <option value={30}>30 Seconds</option>
                          <option value={60}>1 Minute</option>
                          <option value={120}>2 Minutes</option>
                          <option value={300}>5 Minutes</option>
                          <option value={600}>10 Minutes</option>
                        </select>
                      </div>


                      {/* Sound Toggle */}
                      <div className="flex items-center justify-between mb-3 pt-1">
                        <label className="text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">Audio Alerts (Ticks/Done)</label>
                        <input
                          type="checkbox"
                          checked={countdownSound}
                          onChange={(e) => setCountdownSound(e.target.checked)}
                          className="rounded-none border-stone-300 text-indigo-605 focus:ring-0 focus:ring-offset-0"
                        />
                      </div>

                      {/* Volume Control */}
                      {countdownSound && (
                        <div className="space-y-1 mb-4">
                          <div className="flex justify-between text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                            <span>Alert Volume</span>
                            <span>{countdownVolume}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={countdownVolume}
                            onChange={(e) => setCountdownVolume(parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}

                      <MatrixButton
                        actionKey="send_countdown"
                        actionStates={actionStates}
                        onClick={handleSendCountdown}
                        disabled={loadingAlgo !== null}
                        className="neo-btn neo-btn-primary w-full text-xs font-bold h-9"
                        defaultText="Start Countdown"
                        loadingText="Starting..."
                      />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== GAME PLAYGROUND TAB ==================== */}
          <TabsContent value="game" className="space-y-6 focus-visible:outline-none">
            <div className="flex flex-col md:flex-row gap-6">
              
              {/* Left Column: Virtual Matrix Display */}
              <div className="flex-1 space-y-4">
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardHeader className="bg-[#FDFBF7] border-b border-[#1E1E1E]/20 py-3.5 px-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E]">Virtual LED Grid (20 x 24)</CardTitle>
                        <CardDescription className="text-xs text-[#5E5E5E] font-serif">Displays the real-time target coordinate of your red dot</CardDescription>
                      </div>
                      <Button 
                        onClick={() => { setGameX(0); setGameY(0); sendGameCoordinate(0, 0); }} 
                        className="neo-btn h-7 text-[10px] px-3"
                      >
                        Reset (0,0)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-col items-center justify-center bg-[#1E1E1E] border-t border-[#1E1E1E]">
                    <div className="grid gap-0.5 max-w-[340px] md:max-w-[400px] w-full border border-black p-1.5 rounded-none bg-black shadow-none" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
                      {Array.from({ length: ROWS }).map((_, rowIndex) => (
                        <React.Fragment key={rowIndex}>
                          {Array.from({ length: COLS }).map((_, colIndex) => {
                            const isActive = gameX === colIndex && gameY === rowIndex;
                            return (
                              <div
                                key={colIndex}
                                className={`aspect-square transition-all duration-75 ${
                                  isActive 
                                    ? "bg-red-500 shadow-[0_0_10px_#ef4444] scale-110 z-10" 
                                    : "bg-stone-900 border border-stone-950"
                                  }`}
                                style={{ width: "100%" }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="text-[9px] font-serif italic text-stone-400 mt-3 text-center">Fig. 5. — Serpentine coordinate register preview canvas.</span>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Telemetry & Controls */}
              <div className="w-full md:w-80 space-y-6">
                
                {/* Telemetry Panel */}
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardHeader className="pb-3 border-b border-[#1E1E1E]/20">
                    <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-[#1E1E1E]" />
                      Live Feed
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5E5E5E] font-serif">Physical computing response telemetry</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-[#FDFBF7] border border-stone-300 p-3 rounded-none">
                        <span className="text-[#5E5E5E] font-bold font-sans-display text-[9px] uppercase tracking-wider block mb-1">Target Pixel</span>
                        <span className="text-[#1E1E1E] font-bold text-sm block font-mono">X: {gameX}, Y: {gameY}</span>
                      </div>
                      <div className="bg-[#FDFBF7] border border-stone-300 p-3 rounded-none">
                        <span className="text-[#5E5E5E] font-bold font-sans-display text-[9px] uppercase tracking-wider block mb-1">RTT Ping</span>
                        <span className="text-[#1E1E1E] font-bold text-sm block font-mono flex items-center gap-1.5">
                          {gamePingMs !== null ? `${gamePingMs}ms` : "--"}
                          {gameSending && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600 inline" />}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Mobile D-Pad */}
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardHeader className="pb-2 border-b border-[#1E1E1E]/20">
                    <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E]">Virtual Controller</CardTitle>
                    <CardDescription className="text-xs text-[#5E5E5E] font-serif">Use Arrow Keys on your keyboard or tap below.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center py-6 bg-[#FDFBF7]">
                    <div className="grid grid-cols-3 gap-1 w-36 h-36">
                      <div />
                      <Button
                        onClick={() => moveGame(0, -1)}
                        className="neo-btn p-0 flex items-center justify-center h-12 w-12"
                      >
                        <ArrowUp className="w-5 h-5 text-stone-600" />
                      </Button>
                      <div />
                      <Button
                        onClick={() => moveGame(-1, 0)}
                        className="neo-btn p-0 flex items-center justify-center h-12 w-12"
                      >
                        <ArrowLeft className="w-5 h-5 text-stone-600" />
                      </Button>
                      <div className="bg-[#1E1E1E] border border-black h-12 w-12 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#FDFBF7]" />
                      </div>
                      <Button
                        onClick={() => moveGame(1, 0)}
                        className="neo-btn p-0 flex items-center justify-center h-12 w-12"
                      >
                        <ArrowRight className="w-5 h-5 text-stone-600" />
                      </Button>
                      <div />
                      <Button
                        onClick={() => moveGame(0, 1)}
                        className="neo-btn p-0 flex items-center justify-center h-12 w-12"
                      >
                        <ArrowDown className="w-5 h-5 text-stone-600" />
                      </Button>
                      <div />
                    </div>
                  </CardContent>
                </Card>
                
              </div>
            </div>
          </TabsContent>

          {/* ==================== ARITHMETIC TAB ==================== */}
          <TabsContent value="math" className="space-y-6 focus-visible:outline-none">
            {gameState === "lobby" ? (
              <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none max-w-xl mx-auto my-12">
                <CardHeader className="pb-4 border-b border-[#1E1E1E]/20 text-center">
                  <CardTitle className="text-2xl text-[#1E1E1E] font-serif font-bold flex items-center justify-center gap-2">
                    <Calculator className="w-6 h-6 text-[#1E1E1E]" />
                    Arithmetic Lab Session
                  </CardTitle>
                  <CardDescription className="text-[#5E5E5E] mt-1.5 font-serif text-sm">
                    Configure your math challenge session.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Select Mode */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">Game Mode</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setMathGameMode("timed")}
                        className={`h-11 font-bold text-xs uppercase rounded-none border border-[#1E1E1E] transition-colors ${mathGameMode === "timed" ? "bg-[#1E1E1E] text-[#FDFBF7]" : "bg-[#FDFBF7] text-[#1E1E1E] hover:bg-[#EFE6CD]"}`}
                      >
                        Timed Challenge
                      </button>
                      <button
                        onClick={() => setMathGameMode("free")}
                        className={`h-11 font-bold text-xs uppercase rounded-none border border-[#1E1E1E] transition-colors ${mathGameMode === "free" ? "bg-[#1E1E1E] text-[#FDFBF7]" : "bg-[#FDFBF7] text-[#1E1E1E] hover:bg-[#EFE6CD]"}`}
                      >
                        Free Play
                      </button>
                    </div>
                  </div>

                  {/* Timed Mode Options */}
                  {mathGameMode === "timed" && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">Time Limit</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[30, 60, 90, 120].map((t) => (
                          <button
                            key={t}
                            onClick={() => setMathTimeLimit(t)}
                            className={`h-9 font-bold text-xs rounded-none border border-[#1E1E1E] transition-colors ${mathTimeLimit === t ? "bg-[#1E1E1E] text-[#FDFBF7]" : "bg-[#FDFBF7] text-[#1E1E1E] hover:bg-[#EFE6CD]"}`}
                          >
                            {t}s
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Background Music Selector (Navidrome integration) */}
                  <div className="space-y-2 border-t border-[#1E1E1E]/10 pt-4">
                    <label className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E] block">Background Music Selection</label>
                    
                    {!selectedMathSong ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search tracks for background..."
                            value={mathMusicQuery}
                            onChange={(e) => setMathMusicQuery(e.target.value)}
                            className="w-full bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none px-3 py-2 text-xs focus:outline-none text-[#1E1E1E]"
                          />
                          {mathMusicLoading && (
                            <div className="absolute right-3 top-2.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                            </div>
                          )}
                        </div>

                        {/* Search Results dropdown list */}
                        {mathMusicResults.length > 0 && (
                          <div className="border border-[#1E1E1E]/80 bg-[#FDFBF7] max-h-40 overflow-y-auto divide-y divide-[#1E1E1E]/10 z-30 relative">
                            {mathMusicResults.slice(0, 5).map((track) => (
                              <button
                                key={track.id}
                                onClick={() => {
                                  setSelectedMathSong(track);
                                  setMathMusicQuery("");
                                  setMathMusicResults([]);
                                }}
                                className="w-full text-left p-2 hover:bg-[#EFE6CD] text-xs font-mono text-[#1E1E1E] transition-colors truncate"
                              >
                                <span className="font-bold">{track.title}</span> – <span className="text-[#5E5E5E]">{track.artist}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between border border-[#1E1E1E] bg-[#EFE6CD]/20 p-2.5 rounded-none text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold font-sans-display text-[9px] uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 border border-green-700 font-mono">ACTIVE</span>
                          <span className="text-[#1E1E1E] font-bold truncate">
                            {selectedMathSong.title} <span className="text-[#5E5E5E] font-normal">({selectedMathSong.artist})</span>
                          </span>
                        </div>
                        <Button
                          onClick={() => setSelectedMathSong(null)}
                          className="neo-btn neo-btn-destructive h-6 px-2 text-[9px] shrink-0 font-bold"
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Two volumes: game volume and music volume */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">Audio Narration (Sound FX)</label>
                      <input
                        type="checkbox"
                        checked={mathSound}
                        onChange={(e) => setMathSound(e.target.checked)}
                        className="rounded-none border-stone-300 text-indigo-605 focus:ring-0 focus:ring-offset-0"
                      />
                    </div>

                    {mathSound && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                          <span>Narration / SFX Volume: {mathVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={mathVolume}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setMathVolume(val);
                            if (typeof window !== "undefined") {
                              sessionStorage.setItem("matrix_math_volume", val.toString());
                            }
                          }}
                          className="w-full"
                        />
                      </div>
                    )}

                    {selectedMathSong && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">
                          <span>Background Music Volume: {mathMusicVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={mathMusicVolume}
                          onChange={(e) => setMathMusicVolume(parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* Phrasing Options */}
                  <details className="group space-y-4 pt-4 border-t border-[#1E1E1E]/10 cursor-pointer">
                    <summary className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E] outline-none select-none list-none flex items-center justify-between">
                      <span>Phrasing Options</span>
                      <span className="text-xs group-open:rotate-180 transition-transform duration-200">▼</span>
                    </summary>
                    <div className="space-y-3 cursor-default pt-2">
                      <div>
                        <div className="text-[10px] font-bold text-[#1E1E1E] mb-2 border-b border-[#1E1E1E]/10 pb-1">Multiplication Phrases</div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-[#5E5E5E]">
                          {["multiplied by", "times", "Lots of", "rows of", "sets of", "the product of", "doubled", "tripled", "quadrupled", "squared"].map((phrase, idx) => (
                            <label key={`mult-${idx}`} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allowedMultiplyPhrases.includes(idx)}
                                onChange={(e) => {
                                  if (e.target.checked) setAllowedMultiplyPhrases(prev => [...prev, idx]);
                                  else setAllowedMultiplyPhrases(prev => prev.filter(p => p !== idx));
                                }}
                                className="rounded-sm border-[#1E1E1E]/40 text-[#1E1E1E] focus:ring-[#1E1E1E]"
                              />
                              <span className="truncate">{phrase}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#1E1E1E] mb-2 border-b border-[#1E1E1E]/10 pb-1 mt-2">Division Phrases</div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-[#5E5E5E]">
                          {["divided by", "divided equally into", "shared equally among", "split in to", "in to equal parts", "the quotient of"].map((phrase, idx) => (
                            <label key={`div-${idx}`} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allowedDividePhrases.includes(idx)}
                                onChange={(e) => {
                                  if (e.target.checked) setAllowedDividePhrases(prev => [...prev, idx]);
                                  else setAllowedDividePhrases(prev => prev.filter(p => p !== idx));
                                }}
                                className="rounded-sm border-[#1E1E1E]/40 text-[#1E1E1E] focus:ring-[#1E1E1E]"
                              />
                              <span className="truncate">{phrase}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Start Button */}
                  <Button
                    onClick={async (e) => {
                      if (e.currentTarget) e.currentTarget.blur();
                      if (timerRef.current) clearInterval(timerRef.current);

                      // 1. Initialize session status to playing in Next.js/MongoDB immediately
                      await fetch("/api/matrix/game-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "playing", score: 0 }),
                      }).catch(() => {});

                      // 2. Set dashboard to loading countdown mode
                      setGameState("loading");
                      setMathIntroTimer("3");

                      // 3. Start game session on Pi Zero (starts background music download + plays ready countdown intro)
                      await fetch("/api/matrix", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          algo: "math_start",
                          music_file: selectedMathSong ? "navidrome" : "none",
                          song_id: selectedMathSong ? selectedMathSong.id : "",
                          music_volume: mathMusicVolume / 100,
                          game_volume: mathVolume / 100,
                          mode: mathGameMode,
                          time_limit: mathTimeLimit,
                        }),
                      }).catch(() => {});

                      // 4. Run local 3-second countdown sequence (3 ➔ 2 ➔ 1 ➔ GO!)
                      const introTimes = [
                        { delay: 1000, label: "2" },
                        { delay: 2000, label: "1" },
                        { delay: 2700, label: "GO!" }
                      ];

                      introTimes.forEach((t) => {
                        setTimeout(() => {
                          setMathIntroTimer(t.label);
                        }, t.delay);
                      });

                      setTimeout(() => {
                        setGameState("playing");
                        setMathScore(0);
                        generateNewQuestion();

                        // 5. If in free play mode and background music is active, start polling game status for song end
                        if (mathGameMode === "free" && selectedMathSong !== null) {
                          timerRef.current = setInterval(async () => {
                            try {
                              const res = await fetch("/api/matrix/game-status");
                              const data = await res.json();
                              if (data.status === "gameover") {
                                setGameState("gameover");
                                clearInterval(timerRef.current!);
                                fetch("/api/matrix", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ algo: "idle" }),
                                }).catch(() => {});
                              }
                            } catch (e) {
                              console.error("Failed to poll math game status:", e);
                            }
                          }, 1000);
                        }
                      }, 3000);
                    }}
                    className="w-full neo-btn neo-btn-primary h-12 font-bold text-sm tracking-wider uppercase"
                  >
                    Start Game Session
                  </Button>


                  {/* Leaderboard/Scoreboard Display */}
                  {leaderboard.length > 0 && (
                    <div className="border-t border-[#1E1E1E]/10 pt-6 space-y-3">
                      <h3 className="text-xs font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] text-center">Top Scorers (Leaderboard)</h3>
                      <div className="border border-[#1E1E1E]/20 overflow-hidden">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="bg-[#1E1E1E]/5 border-b border-[#1E1E1E]/20 font-sans-display uppercase text-[10px] tracking-wider">
                              <th className="p-2.5 font-bold">Rank</th>
                              <th className="p-2.5 font-bold">Name</th>
                              <th className="p-2.5 font-bold">Score</th>
                              <th className="p-2.5 font-bold">Mode</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaderboard.map((entry, idx) => (
                              <tr key={idx} className="border-b border-[#1E1E1E]/10 last:border-0 bg-[#FDFBF7]">
                                <td className="p-2.5">#{idx + 1}</td>
                                <td className="p-2.5 font-bold text-[#1E1E1E]">{entry.name}</td>
                                <td className="p-2.5 text-green-700 font-bold">{entry.score} pts</td>
                                <td className="p-2.5 text-[#5E5E5E]">{entry.mode}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : gameState === "loading" ? (
              <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none max-w-xl mx-auto my-12">
                <CardContent className="p-16 flex flex-col items-center justify-center space-y-6">
                  {/* Retro glowing countdown visual */}
                  <div className="w-24 h-24 rounded-full border-4 border-[#1E1E1E] flex items-center justify-center bg-[#FDFBF7] relative">
                    <Loader2 className="w-20 h-20 animate-spin text-[#1E1E1E]/10 absolute" />
                    <span className="text-xl font-black font-sans-display text-[#1E1E1E] tracking-wider animate-pulse text-center leading-none">
                      {mathIntroTimer === "ARE YOU READY?" ? "READY" : mathIntroTimer}
                    </span>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold font-sans-display text-[#1E1E1E] tracking-widest uppercase">
                      {mathIntroTimer}
                    </p>
                    <p className="text-[10px] text-[#5E5E5E] font-serif italic">
                      {selectedMathSong ? "Buffering audio stream..." : "Starting physical display..."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : gameState === "gameover" ? (
              <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none max-w-xl mx-auto my-12">
                <CardHeader className="pb-4 border-b border-[#1E1E1E]/20 text-center">
                  <CardTitle className="text-2xl text-[#1E1E1E] font-serif font-bold uppercase tracking-wider">Session Complete!</CardTitle>
                  <CardDescription className="text-[#5E5E5E] mt-1.5 font-serif text-sm">
                    Time is up. Let's see how you did!
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center justify-center space-y-6">
                  <div className="text-center">
                    <span className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E]">Your Final Score</span>
                    <div className="text-6xl font-black font-mono text-green-700 my-2">{mathScore}</div>
                    <span className="text-xs text-[#5E5E5E] font-serif">questions answered correctly</span>
                  </div>

                  {/* Name Input */}
                  <div className="w-full space-y-2">
                    <label className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E] block text-center">Enter your name for the scoreboard</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Your name..."
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="flex-1 bg-[#FDFBF7] border border-[#1E1E1E]/80 rounded-none px-3.5 py-2 text-sm focus:outline-none text-[#1E1E1E] font-bold font-mono"
                      />
                      <Button
                        onClick={handleSaveScore}
                        disabled={!playerName.trim()}
                        className="neo-btn neo-btn-primary h-10 px-6 font-bold text-xs"
                      >
                        Save Score
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setGameState("lobby");
                      setPlayerName("");
                      // Reset game status in DB
                      fetch("/api/matrix/game-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "lobby" }),
                      }).catch(() => {});
                    }}
                    className="w-full neo-btn h-11 text-xs font-bold uppercase tracking-wider"
                  >
                    Back to Lobby
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto">
                {/* Left Column: Question & Numpad */}
                <div className="flex-1 space-y-6">
                  {/* Status Bar (Score & Time) */}
                  {mathGameMode === "timed" && (
                    <div className="flex justify-between items-center bg-[#FDFBF7] border border-[#1E1E1E] p-4 font-mono font-bold text-sm">
                      <div className="text-[#991B1B]">⌛ TIME LEFT: {mathTimeLeft}s</div>
                      <div className="text-green-700">★ SCORE: {mathScore}</div>
                    </div>
                  )}

                  {/* Large Question Area */}
                  <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                    <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold font-sans-display uppercase tracking-wider text-[#5E5E5E] mb-2">Solve this fact</span>
                      <div className="text-5xl md:text-6xl font-black font-serif text-[#1E1E1E] my-4 tracking-wide">
                        {mathQuestion.type === "multiply" 
                          ? `${mathQuestion.factorA} × ${mathQuestion.factorB}`
                          : `${mathQuestion.factorA} ÷ ${mathQuestion.factorB}`
                        } = {userAnswer || "?"}
                      </div>
                      
                      {/* Feedback Badge */}
                      {answerFeedback && (
                        <div className="mt-3 flex items-center justify-center">
                          {answerFeedback === "correct" ? (
                            <span className="text-xs font-bold font-sans-display uppercase tracking-wider text-green-700 font-mono">
                              ✓ Correct
                            </span>
                          ) : (
                            <span className="text-xs font-bold font-sans-display uppercase tracking-wider text-[#991B1B] font-mono">
                              ❌ Try Again
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* On-screen Numpad */}
                  <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                        {numPadKeys.map((key) => (
                          <button
                            key={key}
                            onClick={() => handleNumPadPress(key)}
                            className={`h-16 text-xl font-bold border border-[#1E1E1E] transition-all flex items-center justify-center rounded-none shadow-[2px_2px_0px_0px_rgba(30,30,30,1)]
                              ${key === "Enter" ? "bg-[#1E1E1E] text-[#FDFBF7] hover:bg-stone-850" : "bg-[#FDFBF7] text-[#1E1E1E] hover:bg-stone-100"}
                              ${isKeyPressed(key) ? "translate-x-[2px] translate-y-[2px] shadow-none bg-[#E2D5BA]" : ""}
                            `}
                          >
                            {getButtonLabel(key)}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Actions & Help */}
                <div className="w-full md:w-80 space-y-6">
                  <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                    <CardHeader className="pb-3 border-b border-[#1E1E1E]/20">
                      <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E]">Options & Help</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <Button
                        onClick={handleRunMathVisualisation}
                        className="w-full neo-btn neo-btn-primary h-11 font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Help Visualisation
                      </Button>

                      <Button
                        onClick={() => {
                          setGameState("lobby");
                          if (timerRef.current) clearInterval(timerRef.current);
                          handleTriggerAlgo({ id: "idle", name: "Idle Mode", description: "", icon: Clock, color: "" });
                        }}
                        className="w-full neo-btn neo-btn-destructive h-11 text-xs font-bold uppercase tracking-wider"
                      >
                        End Session
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ==================== PATHFINDING TAB ==================== */}
          <TabsContent value="pathfinding" className="space-y-6 focus-visible:outline-none">
            <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
              <CardHeader className="pb-4 border-b border-[#1E1E1E]/20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl text-[#1E1E1E] font-serif font-bold flex items-center gap-2">
                      <Route className="w-6 h-6 text-[#1E1E1E]" />
                      Pathfinding Console
                    </CardTitle>
                    <CardDescription className="text-[#5E5E5E] mt-1 font-sans-display text-xs italic lowercase">
                      interactive routing algorithms and search visualisations
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 border border-[#991B1B] bg-transparent px-3 py-1.5 rounded-none self-start sm:self-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-[#991B1B] opacity-75"></span>
                      <span className="relative inline-flex rounded-none h-2 w-2 bg-[#991B1B]"></span>
                    </span>
                    <span className="text-[10px] font-bold text-[#991B1B] uppercase tracking-wider font-mono">
                      MODE: SIMULATION
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-[#1E1E1E] pt-4 bg-[#FDFBF7]">
                <p className="text-xs leading-relaxed text-[#5E5E5E]">
                  <strong className="text-[#1E1E1E] uppercase font-bold">Interactive Canvas:</strong> Select a tool below to customise the grid. Click and drag on the grid to draw walls. Click "Run Visualiser" to animate the selected pathfinding algorithm in real-time.
                </p>
              </CardContent>
            </Card>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Column: Interactive Grid Visualiser */}
              <div className="flex-1 space-y-4">
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardHeader className="bg-[#FDFBF7] border-b border-[#1E1E1E]/20 py-3.5 px-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E]">Pathfinding Grid (20 x 24)</CardTitle>
                        <CardDescription className="text-xs text-[#5E5E5E] font-serif">Draw walls, place start/target nodes and witness shortest path convergence</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={resetPfPath} 
                          disabled={pfIsRunning}
                          className="neo-btn h-7 text-[10px] px-3"
                        >
                          Clear Path
                        </Button>
                        <Button 
                          onClick={clearPfAll} 
                          disabled={pfIsRunning}
                          className="neo-btn h-7 text-[10px] px-3"
                        >
                          Reset Grid
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-col items-center justify-center bg-[#1E1E1E] border-t border-[#1E1E1E] select-none">
                    <div 
                      className="grid gap-0.5 max-w-[340px] md:max-w-[400px] w-full border border-black p-1.5 rounded-none bg-black shadow-none" 
                      style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
                      onMouseLeave={handleCellMouseUp}
                    >
                      {pfGrid.map((row, rowIndex) => (
                        <React.Fragment key={rowIndex}>
                          {row.map((cell, colIndex) => {
                            let cellBgClass = "bg-stone-900 border border-stone-950";
                            if (cell === "start") cellBgClass = "bg-emerald-500 shadow-[0_0_8px_#10b981] scale-105 z-10";
                            else if (cell === "target") cellBgClass = "bg-rose-500 shadow-[0_0_8px_#f43f5e] scale-105 z-10";
                            else if (cell === "wall") cellBgClass = "bg-stone-600 border border-stone-700";
                            else if (cell === "visited") cellBgClass = "bg-sky-500/80 shadow-[0_0_4px_rgba(14,165,233,0.4)] scale-90";
                            else if (cell === "path") cellBgClass = "bg-amber-400 shadow-[0_0_10px_#fbbf24] scale-[1.05] z-10";

                            return (
                              <div
                                key={colIndex}
                                className={`aspect-square w-full cursor-crosshair transition-all duration-75 ${cellBgClass}`}
                                onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                                onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                                onMouseUp={handleCellMouseUp}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="text-[9px] font-serif italic text-stone-400 mt-3 text-center">Fig. 6. — Pathfinding workspace matrix. Nodes traversed are highlighted dynamically.</span>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Settings & Controls */}
              <div className="w-full lg:w-80 space-y-6">
                
                {/* Select Algorithm */}
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardHeader className="pb-3 border-b border-[#1E1E1E]/20">
                    <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-[#1E1E1E]" />
                      Algorithm Options
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5E5E5E] font-serif">Configure the routing method</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#5E5E5E] block font-sans-display">Selected Algorithm</label>
                      <select 
                        value={pfAlgo}
                        onChange={(e) => setPfAlgo(e.target.value)}
                        disabled={pfIsRunning}
                        className="w-full bg-[#FDFBF7] border border-[#1E1E1E] px-3 py-2 text-xs font-bold font-mono text-[#1E1E1E] focus:outline-none focus:ring-0 rounded-none h-10"
                      >
                        <option value="dijkstra">Dijkstra's Algorithm</option>
                        <option value="astar">A* Search (Manhattan)</option>
                        <option value="bfs">Breadth-First Search (BFS)</option>
                        <option value="dfs">Depth-First Search (DFS)</option>
                      </select>
                      <span className="text-[10px] text-[#7E7E7E] block italic leading-tight min-h-[40px]">
                        {pfAlgo === "dijkstra" && "Dijkstra: Guarantees the shortest path. Explores nodes in order of cumulative distance."}
                        {pfAlgo === "astar" && "A* Search: Guarantees the shortest path. Fast search guided by distance heuristic to target."}
                        {pfAlgo === "bfs" && "BFS: Guarantees the shortest path in unweighted graphs. Explores level-by-level."}
                        {pfAlgo === "dfs" && "DFS: Explores as deep as possible before backtracking. Does not guarantee the shortest path."}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Drawing Tools */}
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardHeader className="pb-3 border-b border-[#1E1E1E]/20">
                    <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] flex items-center gap-1.5">
                      <ListFilter className="w-4 h-4 text-[#1E1E1E]" />
                      Brush Toolset
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5E5E5E] font-serif">Interact with the workspace grid</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setPfTool("wall")}
                        disabled={pfIsRunning}
                        className={`neo-btn text-[10px] h-9 px-2 flex items-center justify-center gap-1 ${
                          pfTool === "wall" ? "bg-[#1E1E1E] text-white" : ""
                        }`}
                      >
                        <span className="w-2.5 h-2.5 bg-stone-600 border border-stone-800" />
                        Draw Walls
                      </Button>
                      <Button
                        onClick={() => setPfTool("eraser")}
                        disabled={pfIsRunning}
                        className={`neo-btn text-[10px] h-9 px-2 flex items-center justify-center gap-1 ${
                          pfTool === "eraser" ? "bg-[#1E1E1E] text-white" : ""
                        }`}
                      >
                        <span className="w-2.5 h-2.5 bg-stone-900 border border-dashed border-stone-400" />
                        Eraser
                      </Button>
                      <Button
                        onClick={() => setPfTool("start")}
                        disabled={pfIsRunning}
                        className={`neo-btn text-[10px] h-9 px-2 flex items-center justify-center gap-1 ${
                          pfTool === "start" ? "bg-[#1E1E1E] text-white" : ""
                        }`}
                      >
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                        Set Start
                      </Button>
                      <Button
                        onClick={() => setPfTool("target")}
                        disabled={pfIsRunning}
                        className={`neo-btn text-[10px] h-9 px-2 flex items-center justify-center gap-1 ${
                          pfTool === "target" ? "bg-[#1E1E1E] text-white" : ""
                        }`}
                      >
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                        Set Target
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Speed & Sound Controls */}
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardHeader className="pb-3 border-b border-[#1E1E1E]/20">
                    <CardTitle className="text-sm font-bold font-sans-display uppercase tracking-wider text-[#1E1E1E] flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-[#1E1E1E]" />
                      Visualisation Speed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E5E5E] font-sans-display">Delay Step (ms)</span>
                        <span className="font-mono font-bold">{pfSpeed}ms</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="200"
                        step="5"
                        value={pfSpeed}
                        onChange={(e) => setPfSpeed(parseInt(e.target.value))}
                        disabled={pfIsRunning}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-[#1E1E1E]/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E5E5E] font-sans-display flex items-center gap-1">
                          <Music className="w-3.5 h-3.5" /> Sound Effects
                        </span>
                        <Switch
                          checked={pfSound}
                          onCheckedChange={setPfSound}
                          disabled={pfIsRunning}
                        />
                      </div>
                      {pfSound && (
                        <div className="space-y-1 mt-2">
                          <div className="flex justify-between text-[10px] font-bold font-mono">
                            <span>VOLUME</span>
                            <span>{pfVolume}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pfVolume}
                            onChange={(e) => setPfVolume(parseInt(e.target.value))}
                            disabled={pfIsRunning}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Execution panel */}
                <Card className="border-[#1E1E1E]/80 shadow-none bg-[#FDFBF7] rounded-none">
                  <CardContent className="p-4 bg-[#FDFBF7]">
                    <div className="space-y-2">
                      <Button
                        onClick={runPfVisualiser}
                        disabled={pfIsRunning || pfSending}
                        className="w-full neo-btn neo-btn-primary h-12 font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-1.5"
                      >
                        {pfIsRunning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Visualising...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Run Visualiser
                          </>
                        )}
                      </Button>
                      <MatrixButton
                        actionKey="run_pf"
                        actionStates={actionStates}
                        onClick={runPfOnMatrix}
                        disabled={pfIsRunning || pfSending}
                        className="w-full neo-btn h-10 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                        defaultText="Run on LED Matrix"
                        loadingText="Sending..."
                        icon={Upload}
                      />
                      <Button
                        onClick={generateRandomMaze}
                        disabled={pfIsRunning || pfSending}
                        className="w-full neo-btn h-10 text-xs font-bold uppercase tracking-wider"
                      >
                        Generate Maze
                      </Button>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="mt-16 pt-8 border-t border-[#1E1E1E]/80 text-center pb-8 max-w-3xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            <span className="font-mono text-xs font-bold text-[#1E1E1E]">T(n) = O(n log n) &nbsp;•&nbsp; S(n) = O(log n)</span>
            
            <div className="text-left w-full space-y-2 border border-[#1E1E1E]/20 bg-[#FDFBF7] p-4 text-[10px] font-serif text-[#5E5E5E] leading-relaxed">
              <h5 className="font-bold uppercase tracking-wider text-[#1E1E1E] text-center mb-2">Academic references & inspirations</h5>
              <p>
                Bingmann, T. (2013). <em>The Sound of Sorting - Visualization and Audibilization of Sorting Algorithms</em>. Available at: <a href="https://panthema.net/2013/sound-of-sorting/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1E1E1E]">https://panthema.net/2013/sound-of-sorting/</a> (Accessed: 6 July 2026).
              </p>
              <p>
                Garff, J. (2015). <em>rpi_ws281x: Userspace Raspberry Pi PWM library for WS281X LEDs</em>. Available at: <a href="https://github.com/jgarff/rpi_ws281x" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1E1E1E]">https://github.com/jgarff/rpi_ws281x</a> (Accessed: 6 July 2026).
              </p>
              <p>
                Navidrome (2020). <em>Navidrome Music Server</em>. Available at: <a href="https://www.navidrome.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1E1E1E]">https://www.navidrome.org</a> (Accessed: 6 July 2026).
              </p>
              <p>
                Subsonic (2019). <em>Subsonic API Schema</em>. Available at: <a href="http://subsonic.org/pages/api.jsp" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1E1E1E]">http://subsonic.org/pages/api.jsp</a> (Accessed: 6 July 2026).
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <a 
                href="https://reveleigh.com"
                className="font-serif text-[10px] text-[#5E5E5E]/60 italic hover:text-[#1E1E1E] transition-colors underline decoration-dotted"
              >
                reveleigh.com
              </a>

              <span className="text-[#5E5E5E]/40 text-[10px]">|</span>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="font-serif text-[10px] text-[#5E5E5E]/60 italic hover:text-[#1E1E1E] transition-colors underline decoration-dotted bg-transparent border-none p-0 cursor-pointer">
                    Info
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#FDFBF7] border border-[#1E1E1E] rounded-none p-6">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-2xl text-[#1E1E1E] mb-4">Project Info & Specs</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
<section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Project Vision</h2>
              <p className="text-[#5E5E5E] text-sm leading-relaxed mb-4">
                Build a large-scale, tactile physical computing display to teach core Computer Science concepts, 
                bridging abstract logic with interactive physical hardware.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-transparent border border-[#1E1E1E]/40 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Algorithm Visualisation</h3>
                  <p className="text-xs text-[#5E5E5E] leading-relaxed">
                    Visualise sorting algorithms: Bubble, Selection, Insertion, Merge, Quick, Radix on a dynamic 480-LED canvas.
                  </p>
                </div>
                <div className="bg-transparent border border-[#1E1E1E]/40 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Auralization</h3>
                  <p className="text-xs text-[#5E5E5E] leading-relaxed">
                    Map array values to musical frequencies. Comparisons = clicks, Swaps = tone sweeps, Pivots = drone.
                  </p>
                </div>
                <div className="bg-transparent border border-[#1E1E1E]/40 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Image Processing</h3>
                  <p className="text-xs text-[#5E5E5E] leading-relaxed">
                    OpenCV analysis, spatial color averaging, downsample with cv2.INTER_AREA, output to matrix.
                  </p>
                </div>
              </div>
            </section>

            {/* Core Change */}
            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Core Change: 5V to 12V</h2>
              <div className="space-y-4 text-[#5E5E5E]">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-transparent border border-red-800/40 p-4 rounded-none">
                    <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-red-800 mb-2">Previous (5V WS2812B)</h3>
                    <ul className="space-y-1 text-xs text-[#5E5E5E]">
                      <li>• 8+ power injection points</li>
                      <li>• 14AWG bus wires</li>
                      <li>• Zone isolation required</li>
                      <li>• Complex wiring</li>
                    </ul>
                  </div>
                  <div className="bg-transparent border border-emerald-800/40 p-4 rounded-none">
                    <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-emerald-800 mb-2">New (12V WS2815)</h3>
                    <ul className="space-y-1 text-xs text-[#5E5E5E]">
                      <li>• 2 power injection points</li>
                      <li>• Single 12V rail</li>
                      <li>• No zone isolation</li>
                      <li>• Simplified wiring</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Power & Electrical */}
            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Power & Electrical</h2>
              <div className="space-y-4 text-[#5E5E5E]">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                    <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Power Supply</h3>
                    <ul className="space-y-1 text-xs text-[#5E5E5E]">
                      <li>• Tiger Power 12V 10A (120W)</li>
                      <li>• Desktop brick (UKCA/CE compliant)</li>
                      <li>• External - safe, PAT testable</li>
                    </ul>
                  </div>
                  <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                    <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Frame Input</h3>
                    <ul className="space-y-1 text-xs text-[#5E5E5E]">
                      <li>• 5.5mm x 2.5mm Female DC Jack</li>
                      <li>• Panel-mounted, threaded metal</li>
                      <li>• 10A high-current rated</li>
                    </ul>
                  </div>
                  <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                    <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Internal Distribution</h3>
                    <ul className="space-y-1 text-xs text-[#5E5E5E]">
                      <li>• WAGO lever connectors</li>
                      <li>• 12V split to components</li>
                    </ul>
                  </div>
                  <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                    <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">DigiAmp+ Power</h3>
                    <ul className="space-y-1 text-xs text-[#5E5E5E]">
                      <li>• Accepts 12V rail directly</li>
                      <li>• Steps down to 5.1V for Pi</li>
                      <li>• No extra buck converter needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Safety */}
            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Safety Protocol</h2>
              <div className="grid md:grid-cols-2 gap-4 text-[#5E5E5E]">
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Transient Protection</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• 25V 2200µF Electrolytic Capacitor</li>
                    <li>• Across 12V and Ground in WAGO block</li>
                    <li>• Smooths rapid LED current swings</li>
                  </ul>
                </div>
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Short Circuit Protection</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• ATC Inline Fuse Holder</li>
                    <li>• 14AWG copper leads</li>
                    <li>• 10A Red Automotive Blade Fuse</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Construction */}
            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Materials & Construction</h2>
              <div className="grid md:grid-cols-2 gap-4 text-[#5E5E5E]">
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Chassis</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• 6mm Plywood</li>
                    <li>• Structural mass for soundboard</li>
                    <li>• Warm acoustic tone</li>
                  </ul>
                </div>
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Joints</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• Neoprene rubber foam gasket</li>
                    <li>• Absorbs vibrations</li>
                    <li>• Prevents rattling at high volume</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Logic & Signal */}
            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Logic & Signal</h2>
              <div className="grid md:grid-cols-2 gap-4 text-[#5E5E5E]">
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Level Shifter</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• 74AHCT125</li>
                    <li>• Pi GPIO 18 → 5V at Pixel #1</li>
                    <li>• Steps up 3.3V to stable 5V</li>
                  </ul>
                </div>
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Power Injection</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• Pixel #120 (Row 5, 25%)</li>
                    <li>• Pixel #360 (Row 15, 75%)</li>
                    <li>• Symmetrical at outer frame border</li>
                  </ul>
                </div>
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">WS2815 Data Lines</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• DI → Level shifter output</li>
                    <li>• First LED BI → Ground</li>
                    <li>• BI auto-links to DO (fault tolerance)</li>
                  </ul>
                </div>
                <div className="bg-transparent border border-stone-300 p-4 rounded-none">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E] mb-2">Algorithmic Sounds</h3>
                  <ul className="space-y-1 text-xs text-[#5E5E5E]">
                    <li>• Comparisons = clicks/ticks</li>
                    <li>• Swaps = tone sweeps</li>
                    <li>• Pivots = low drone</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Matrix Layout</h2>
              <div className="text-[#5E5E5E] text-xs space-y-2">
                <p>24x20 grid (480 LEDs), 12V WS2815, serpentine layout starting Top-Left (0,0)</p>
                <p>Even rows: left-to-right, Odd rows: right-to-left</p>
                <p>Data: GPIO 10 (SPI MOSI), rpi_ws281x library</p>
                <p>Brain: Pi Zero 2 W + DigiAmp+ (40-pin GPIO)</p>
              </div>
            </section>

            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Software Plan: Audio-Visual Sorting</h2>
              
              <div className="text-[#5E5E5E] text-xs space-y-4">
                <p>
                  The sorting algorithms will be visualised with sound. Each array value maps to a specific frequency, 
                  making algorithmic efficiency immediately audible.
                </p>

                <div className="bg-transparent border border-stone-300 p-4 rounded-none space-y-3">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E]">Step 1: Pre-Bake the 8-Bit Audio Assets</h3>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Generate 24 .wav files (triangle wave)</li>
                    <li>Frequencies: 120 Hz to 1,212 Hz (C-Major scale, logarithmic)</li>
                    <li>Attack: 0, Sustain/Decay: 100-150ms</li>
                    <li>Name: 0.wav through 23.wav → /sounds folder</li>
                  </ul>
                </div>

                <div className="bg-transparent border border-stone-300 p-4 rounded-none space-y-3">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E]">Step 2: Initialize Pygame Mixer with Polyphony</h3>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>pygame.mixer.pre_init() with low buffer (512/1024)</li>
                    <li>pygame.mixer.set_num_channels(16)</li>
                    <li>Pre-load all 24 sounds into memory for instant playback</li>
                  </ul>
                </div>

                <div className="bg-transparent border border-stone-300 p-4 rounded-none space-y-3">
                  <h3 className="font-bold font-sans-display text-xs uppercase tracking-wider text-[#1E1E1E]">Step 3: Bind Sound to Visual Grid Events</h3>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Read value Y (0-23) of bar being moved</li>
                    <li>Trigger sound_list[y].play()</li>
                    <li>Pass (x,y) to matrix visualiser via SPI (GPIO 10)</li>
                  </ul>
                </div>

                <p className="text-stone-500 italic">
                  Reference: <a href="https://panthema.net/2013/sound-of-sorting/" target="_blank" rel="noopener noreferrer" className="text-blue-650 hover:underline">panthema.net/2013/sound-of-sorting/</a>
                </p>

                <p className="text-stone-500 text-[10px] mt-4">
                  Full software plan: <a href="https://github.com/reveleigh/dump/tree/main/LED-Matrix" target="_blank" rel="noopener noreferrer" className="text-blue-650 hover:underline">github.com/reveleigh/dump/LED-Matrix</a>
                </p>
              </div>
            </section>

            {/* Shopping List */}
            <section className="bg-transparent p-0  rounded-none">
              <h2 className="text-xl font-bold font-serif mb-4 text-[#1E1E1E]">Shopping List</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-[#1E1E1E]">
                  <thead>
                    <tr className="border-b border-[#1E1E1E] text-[#1E1E1E] font-bold uppercase tracking-wider text-[11px] font-sans-display">
                      <th className="text-left py-2 px-2">Item</th>
                      <th className="text-left py-2 px-2">Spec</th>
                      <th className="text-center py-2 px-2 w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 text-stone-400 line-through">Raspberry Pi Zero</td>
                      <td className="py-2.5 px-2 text-stone-400 line-through">-</td>
                      <td className="py-2.5 px-2 text-center text-green-700 font-bold font-sans-display">✓</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 text-stone-400 line-through">IQAudio DigiAmp+</td>
                      <td className="py-2.5 px-2 text-stone-400 line-through">Powers Pi via GPIO</td>
                      <td className="py-2.5 px-2 text-center text-green-700 font-bold font-sans-display">✓</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">74AHCT125 Level Shifter</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">3.3V to 5V</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">WAGO Connectors</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">For power connections</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 text-stone-400 line-through">Dayton Audio Exciter</td>
                      <td className="py-2.5 px-2 text-stone-400 line-through">DAEX30HESF-4 40W</td>
                      <td className="py-2.5 px-2 text-center text-green-700 font-bold font-sans-display">✓</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">DC Power Brick</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">Tiger Power 12V 10A (120W)</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">DC Jack (Female)</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">5.5mm x 2.5mm, panel mount, 10A</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">DC Pigtail Cable</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">5.5mm x 2.5mm Male, 14AWG/16AWG</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">WAGO Connectors</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">Lever splicing</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Capacitor</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">25V 2200µF Electrolytic</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Fuse Holder</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">ATC Inline</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Fuse</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">10A Red Automotive Blade</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Plywood</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">6mm</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Neoprene Gasket</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">Foam tape</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Noctua Fan</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">24V 40mm PWM</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Foam Board</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">2mm Expanded PVC</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 text-stone-400 line-through">Thick Card</td>
                      <td className="py-2.5 px-2 text-stone-400 line-through">For front grid</td>
                      <td className="py-2.5 px-2 text-center text-green-700 font-bold font-sans-display">✓</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 text-stone-400 line-through">Velum Cubes</td>
                      <td className="py-2.5 px-2 text-stone-400 line-through">28mm transparent</td>
                      <td className="py-2.5 px-2 text-center text-green-700 font-bold font-sans-display">✓</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Wood for Frame</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">-</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">Speaker Wire</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">For exciter</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr className="border-b border-stone-250">
                      <td className="py-2.5 px-2 font-medium">14AWG Wire</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">Bus wires</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-2 font-medium">20AWG Wire</td>
                      <td className="py-2.5 px-2 text-[#5E5E5E]">Tap wires</td>
                      <td className="py-2.5 px-2 text-center text-red-700 font-bold font-sans-display">❌</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-center">
                <span className="text-[10px] font-serif italic text-stone-500">Fig. 3. — Bill of materials and procurement status register.</span>
                <p className="text-stone-400 text-[10px] mt-1 font-serif">
                  Tell me when you buy something and I&apos;ll mark it as purchased
                </p>
              </div>
            </section>
                  </div>
                </DialogContent>
              </Dialog>
              <span className="text-[#5E5E5E]/40 text-[10px]">|</span>
              <button 
                onClick={handleRickroll}
                className="font-serif text-[10px] text-[#5E5E5E]/60 italic hover:text-[#1E1E1E] transition-colors underline decoration-dotted bg-transparent border-none p-0 cursor-pointer"
              >
                Don't click me
              </button>
            </div>
          </div>
        </footer>
              </div>
    </div>
  );
}
