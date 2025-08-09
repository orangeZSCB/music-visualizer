document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素获取
    const settingsPanel = document.getElementById('settings-panel');
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    const startBtn = document.getElementById('start-btn');
    const mp3Input = document.getElementById('mp3-input');
    const lrcInput = document.getElementById('lrc-input');
    const fontUrlInput = document.getElementById('font-url-input');
    const audioPlayer = document.getElementById('audio-player');
    const circle = document.getElementById('circle');
    const lyricsP = document.getElementById('lyrics');
    const bodyEl = document.body;

    // 变量声明
    let audioContext, analyser, sourceNode, dataArray;
    let lyricsData = [], currentLyricIndex = -1, animationFrameId;

    // 事件监听
    toggleSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    startBtn.addEventListener('click', () => {
        const mp3File = mp3Input.files[0];
        const lrcFile = lrcInput.files[0];

        if (!mp3File || !lrcFile) {
            alert('请先选择 MP3 和 LRC 文件！');
            return;
        }

        applyCustomFont();

        Promise.all([readMp3File(mp3File), readLrcFile(lrcFile)])
            .then(() => {
                console.log("音频和歌词文件已准备就绪。");
                setupAudioAPI();
                audioPlayer.play();
                settingsPanel.classList.add('hidden');
            })
            .catch(error => {
                console.error("文件处理失败:", error);
                alert("文件处理失败。");
            });
    });

    // 功能函数
    function applyCustomFont() {
        const fontUrl = fontUrlInput.value.trim();
        if (!fontUrl) return;

        let style = document.getElementById('custom-font-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'custom-font-style';
            document.head.appendChild(style);
        }
        style.textContent = `@import url('${fontUrl}');`;
        try {
            const family = new URL(fontUrl).searchParams.get('family');
            if (family) {
                lyricsP.style.fontFamily = `'${family.split(':')[0].replace(/\+/g, ' ')}', sans-serif`;
            }
        } catch (e) {
            console.warn("无法自动解析字体名称。");
        }
    }

    function readMp3File(file) {
        return new Promise(resolve => {
            URL.revokeObjectURL(audioPlayer.src);
            audioPlayer.src = URL.createObjectURL(file);
            audioPlayer.onloadedmetadata = resolve;
        });
    }

    function readLrcFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    lyricsData = parseLRC(e.target.result);
                    lyricsP.textContent = lyricsData[0]?.text || '...';
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    }

    function parseLRC(lrcContent) {
        const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)/;
        return lrcContent
            .split('\n')
            .map(line => {
                const match = line.match(timeRegex);
                if (!match) return null;
                const [, min, sec, frac, text] = match;
                const time = parseInt(min) * 60 + parseInt(sec) + (frac.length === 2 ? parseInt(frac) / 100 : parseInt(frac) / 1000);
                return { time, text: text.trim() || '...' };
            })
            .filter(Boolean)
            .sort((a, b) => a.time - b.time);
    }

    function setupAudioAPI() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            sourceNode = audioContext.createMediaElementSource(audioPlayer);
            sourceNode.connect(analyser);
            analyser.connect(audioContext.destination);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        updateVisuals();
    }

    function updateVisuals() {
        analyser.getByteFrequencyData(dataArray);
        const averageLoudness = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLoudness = averageLoudness / 128;

        // --- 样式计算 ---
        const circleScale = normalizedLoudness * 3.0;
        const lyricScale = 1 + normalizedLoudness * 0.4;
        const hue = Math.floor(normalizedLoudness * 360 + 200) % 360;
        const circleColor = `hsl(${hue}, 80%, 55%)`;

        // --- 应用样式 ---
        circle.style.transform = `scale(${circleScale})`;
        circle.style.backgroundColor = circleColor;
        lyricsP.style.transform = `scale(${lyricScale})`;

        // 根据响度阈值改变背景颜色
        // 改动点 1: 降低阈值，更容易触发
        const LOUDNESS_THRESHOLD = 0.3;
        if (normalizedLoudness > LOUDNESS_THRESHOLD) {
            // 改动点 2: 增加背景的亮度和饱和度，使其更明显
            bodyEl.style.backgroundColor = `hsl(${hue}, 60%, 30%)`;
        } else {
            // 响度回落时，恢复黑色背景
            bodyEl.style.backgroundColor = '#000000';
        }

        updateLyricText();
        animationFrameId = requestAnimationFrame(updateVisuals);
    }
    
    function updateLyricText() {
        const currentTime = audioPlayer.currentTime;
        let newLyricIndex = lyricsData.findIndex(lyric => lyric.time > currentTime) - 1;
        if (newLyricIndex === -2) {
            newLyricIndex = lyricsData.length - 1;
        }
        if (newLyricIndex !== currentLyricIndex) {
            currentLyricIndex = newLyricIndex;
            const newText = lyricsData[currentLyricIndex]?.text || ' ';
            if (lyricsP.textContent !== newText) {
                lyricsP.textContent = newText;
            }
        }
    }
});