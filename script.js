const BOARD_SIZE = 8;
const PIECES = {
    KING: '♔',
    QUEEN: '♕',
    ROOK: '♖',
    BISHOP: '♗',
    KNIGHT: '♘',
    PAWN: '♙'
};

// Map for internal representation to display symbol
// Actually, since we want double-sided pieces, we can use the same symbol but change color.
// Let's just use generic names for logic and map to symbols for display.
const PIECE_TYPES = {
    KING: 'king',
    QUEEN: 'queen',
    ROOK: 'rook',
    BISHOP: 'bishop',
    KNIGHT: 'knight',
    PAWN: 'pawn'
};

const SYMBOLS = {
    [PIECE_TYPES.KING]: '♔',
    [PIECE_TYPES.QUEEN]: '♕',
    [PIECE_TYPES.ROOK]: '♖',
    [PIECE_TYPES.BISHOP]: '♗',
    [PIECE_TYPES.KNIGHT]: '♘',
    [PIECE_TYPES.PAWN]: '♙'
};

let board = [];
let turn = 'white';
let selectedSquare = null;
let validMoves = [];
let gameOver = false;
let isCpuMode = false;
let cpuColor = 'black';

// Sound Controller
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {
    move: () => playTone(300, 'sine', 0.1),
    capture: () => playTone(150, 'sawtooth', 0.2), // Capture own piece
    flip: () => playTone(600, 'triangle', 0.1),
    win: () => playMelody()
};

function playTone(freq, type, duration) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playMelody() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    notes.forEach((note, i) => {
        setTimeout(() => playTone(note, 'sine', 0.2), i * 200);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    document.getElementById('pass-btn').addEventListener('click', passTurn);
    document.getElementById('reset-btn').addEventListener('click', initGame);
    document.getElementById('modal-reset-btn').addEventListener('click', () => {
        closeModal();
        initGame();
    });
    document.getElementById('cpu-toggle-btn').addEventListener('click', toggleCpuMode);
});

function initGame() {
    board = createInitialBoard();
    turn = 'white';
    gameOver = false;
    selectedSquare = null;
    validMoves = [];
    updateStatus(`White's Turn`);
    closeModal();
    renderBoard();
}

function createInitialBoard() {
    const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));

    const setupRow = (row, color, types) => {
        types.forEach((type, col) => {
            newBoard[row][col] = { type, color, originalColor: color };
        });
    };

    const backRow = [
        PIECE_TYPES.ROOK, PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.QUEEN,
        PIECE_TYPES.KING, PIECE_TYPES.BISHOP, PIECE_TYPES.KNIGHT, PIECE_TYPES.ROOK
    ];
    const pawnRow = Array(8).fill(PIECE_TYPES.PAWN);

    setupRow(0, 'black', backRow);
    setupRow(1, 'black', pawnRow);
    setupRow(6, 'white', pawnRow);
    setupRow(7, 'white', backRow);

    return newBoard;
}

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;

            // Highlight selected
            if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                square.classList.add('selected');
            }

            // Highlight valid moves
            if (validMoves.some(m => m.row === row && m.col === col)) {
                square.classList.add('valid-move');
                square.addEventListener('click', () => {
                    console.log(`Clicked valid move: ${row}, ${col}`);
                    handleMove(row, col);
                });
            } else {
                square.addEventListener('click', () => {
                    console.log(`Clicked square: ${row}, ${col}`);
                    handleSquareClick(row, col);
                });
            }

            const piece = board[row][col];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `piece ${piece.color} original-${piece.originalColor}`;
                pieceEl.textContent = SYMBOLS[piece.type];
                square.appendChild(pieceEl);
            }

            boardEl.appendChild(square);
        }
    }

    const turnIndicator = document.getElementById('turn-indicator');
    turnIndicator.className = `turn-indicator ${turn}-turn`;
    turnIndicator.textContent = `${turn.charAt(0).toUpperCase() + turn.slice(1)}'s Turn`;
}

function handleSquareClick(row, col) {
    console.log(`handleSquareClick called for ${row}, ${col}`);
    if (gameOver) return;

    const piece = board[row][col];

    // Select own piece
    if (piece && piece.color === turn) {
        selectedSquare = { row, col };
        validMoves = getValidMoves(row, col, piece);
        renderBoard();
    } else {
        // Deselect if clicking empty or enemy piece (unless it's a valid move handled by onclick override)
        selectedSquare = null;
        validMoves = [];
        renderBoard();
    }
}

function handleMove(toRow, toCol) {
    if (!selectedSquare) return;

    const { row: fromRow, col: fromCol } = selectedSquare;
    const piece = board[fromRow][fromCol];

    // Move piece
    const targetPiece = board[toRow][toCol];
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;

    if (targetPiece) {
        sounds.capture();
    } else {
        sounds.move();
    }

    // Check for flips (Othello logic)
    const flipped = checkAndFlip(toRow, toCol, piece.color);
    if (flipped > 0) sounds.flip();

    // Check win condition
    const winner = checkWin();
    if (winner) {
        gameOver = true;
        updateStatus(`${winner.toUpperCase()} WINS!`);
        renderBoard();
        showWinModal(winner);
        sounds.win();
        return;
    }

    // Switch turn
    turn = turn === 'white' ? 'black' : 'white';
    selectedSquare = null;
    validMoves = [];
    renderBoard();

    // CPU Turn
    if (isCpuMode && turn === cpuColor && !gameOver) {
        setTimeout(makeCpuMove, 500); // Small delay for realism
    }
}

function passTurn() {
    if (gameOver) return;
    turn = turn === 'white' ? 'black' : 'white';
    selectedSquare = null;
    validMoves = [];
    renderBoard();

    if (isCpuMode && turn === cpuColor && !gameOver) {
        setTimeout(makeCpuMove, 500);
    }
}

function updateStatus(msg) {
    document.getElementById('message-area').textContent = msg;
}

// TODO: Implement actual move logic
function getValidMoves(row, col, piece) {
    const moves = [];
    const color = piece.color;
    const type = piece.type;
    const opponent = color === 'white' ? 'black' : 'white';

    // Helper to add move if valid
    const addMoveIfValid = (r, c) => {
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const target = board[r][c];
            if (!target) {
                moves.push({ row: r, col: c });
                return true; // Continue sliding if empty
            } else if (target.color === color) {
                moves.push({ row: r, col: c }); // Capture own
                return false; // Stop sliding
            }
        }
        return false; // Stop sliding (blocked or out of bounds)
    };

    // Helper for sliding pieces (Rook, Bishop, Queen)
    const addSlidingMoves = (directions) => {
        directions.forEach(dir => {
            for (let i = 1; i < 8; i++) {
                const r = row + dir[0] * i;
                const c = col + dir[1] * i;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) break;

                const target = board[r][c];
                if (!target) {
                    moves.push({ row: r, col: c });
                } else {
                    if (target.color === color) {
                        moves.push({ row: r, col: c });
                    }
                    break; // Blocked
                }
            }
        });
    };

    if (type === PIECE_TYPES.PAWN) {
        // Direction depends on original color (orientation), not current color
        const direction = piece.originalColor === 'white' ? -1 : 1;
        const startRow = piece.originalColor === 'white' ? 6 : 1;

        // Forward 1
        if (!board[row + direction]?.[col]) {
            moves.push({ row: row + direction, col: col });
            // Forward 2
            if (row === startRow && !board[row + direction * 2]?.[col]) {
                moves.push({ row: row + direction * 2, col: col });
            }
        }
        // Capture Diagonals
        [[direction, -1], [direction, 1]].forEach(offset => {
            const r = row + offset[0];
            const c = col + offset[1];
            // Capture OWN pieces only
            if (board[r]?.[c] && board[r][c].color === color) {
                moves.push({ row: r, col: c });
            }
        });
    } else if (type === PIECE_TYPES.KNIGHT) {
        const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        offsets.forEach(offset => addMoveIfValid(row + offset[0], col + offset[1]));
    } else if (type === PIECE_TYPES.ROOK) {
        addSlidingMoves([[0, 1], [0, -1], [1, 0], [-1, 0]]);
    } else if (type === PIECE_TYPES.BISHOP) {
        addSlidingMoves([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    } else if (type === PIECE_TYPES.QUEEN) {
        addSlidingMoves([[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
    } else if (type === PIECE_TYPES.KING) {
        const offsets = [
            [0, 1], [0, -1], [1, 0], [-1, 0],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];
        offsets.forEach(offset => addMoveIfValid(row + offset[0], col + offset[1]));
    }

    return moves;
}

function checkAndFlip(row, col, color, boardState = board) {
    let flippedCount = 0;
    const directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    directions.forEach(dir => {
        let r = row + dir[0];
        let c = col + dir[1];
        let potentialFlips = [];

        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const piece = boardState[r][c];
            if (!piece) break; // Empty square, stop

            if (piece.color !== color) {
                potentialFlips.push({ r, c });
            } else {
                // Found own piece, flip all in between
                if (potentialFlips.length > 0) {
                    potentialFlips.forEach(pos => {
                        boardState[pos.r][pos.c].color = color;
                        flippedCount++;
                        // Add visual feedback class if needed, or just re-render
                    });
                }
                break;
            }
            r += dir[0];
            c += dir[1];
        }
    });

    return flippedCount;
}

function checkWin(boardState = board) {
    let whiteKing = false;
    let blackKing = false;
    let whiteCount = 0;
    let blackCount = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece) {
                if (piece.color === 'white') {
                    whiteCount++;
                    if (piece.type === PIECE_TYPES.KING) whiteKing = true;
                }
                if (piece.color === 'black') {
                    blackCount++;
                    if (piece.type === PIECE_TYPES.KING) blackKing = true;
                }
            }
        }
    }

    // If a king is missing (flipped), the other color wins
    if (!whiteKing) return 'black'; // Black wins
    if (!blackKing) return 'white'; // White wins

    // New Rule: If a player has only 1 piece left, they lose
    if (whiteCount <= 1) return 'black';
    if (blackCount <= 1) return 'white';

    return false;
}

function toggleCpuMode() {
    isCpuMode = !isCpuMode;
    const btn = document.getElementById('cpu-toggle-btn');
    btn.textContent = isCpuMode ? 'Mode: vs CPU' : 'Mode: PvP';
    initGame();
}

function showWinModal(winner) {
    const modal = document.getElementById('win-modal');
    const title = document.getElementById('win-title');
    const msg = document.getElementById('win-message');

    title.textContent = winner === 'white' ? 'White Wins!' : 'Black Wins!';
    title.style.color = winner === 'white' ? '#fff' : '#aaa';
    msg.textContent = `The ${winner === 'white' ? 'Black' : 'White'} King has been flipped!`;

    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('win-modal');
    if (modal) modal.classList.add('hidden');
}

function makeCpuMove() {
    if (gameOver) return;

    // Gather all valid moves
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === cpuColor) {
                const moves = getValidMoves(r, c, piece);
                moves.forEach(m => {
                    allMoves.push({ from: { r, c }, to: m });
                });
            }
        }
    }

    if (allMoves.length === 0) {
        passTurn();
        return;
    }

    // Heuristic Evaluation
    let bestMove = null;
    let bestScore = -Infinity;

    // Helper to clone board
    const cloneBoard = (src) => {
        return src.map(row => row.map(cell => cell ? { ...cell } : null));
    };

    allMoves.forEach(move => {
        let score = 0;

        // 1. Simulate Move
        const simBoard = cloneBoard(board);
        const piece = simBoard[move.from.r][move.from.c];
        const target = simBoard[move.to.row][move.to.col];

        // Apply move
        simBoard[move.to.row][move.to.col] = piece;
        simBoard[move.from.r][move.from.c] = null;

        // 2. Evaluate Self-Capture (Penalty)
        if (target && target.color === cpuColor) {
            score -= 5; // Penalty for eating own piece
        }

        // 3. Evaluate Flips (Reward)
        const flips = checkAndFlip(move.to.row, move.to.col, piece.color, simBoard);
        score += flips * 10; // 10 points per flip

        // 4. Evaluate Win (Huge Reward)
        const winner = checkWin(simBoard);
        if (winner === cpuColor) {
            score += 1000;
        }

        // 5. Randomness (Tie-breaker)
        score += Math.random() * 2;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    });

    // Execute best move
    if (bestMove) {
        selectedSquare = { row: bestMove.from.r, col: bestMove.from.c };
        handleMove(bestMove.to.row, bestMove.to.col);
    } else {
        passTurn();
    }
}
