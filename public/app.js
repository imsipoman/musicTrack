document.addEventListener('DOMContentLoaded', function() {
  // 启用调试日志
  const DEBUG = true;
  function debugLog(...args) {
    if (DEBUG) {
      console.log('[前端调试]', ...args);
    }
  }

  // DOM元素
  const musicFileInput = document.getElementById('musicFile');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadInfo = document.getElementById('uploadInfo');
  const bpmInput = document.getElementById('bpmInput');
  const offsetInput = document.getElementById('offsetInput');
  const difficultyInput = document.getElementById('difficultyInput');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const saveBtn = document.getElementById('saveBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const jsonContent = document.getElementById('jsonContent');
  
  // 速度控制按钮
  const speed05Btn = document.getElementById('speed05Btn');
  const speed10Btn = document.getElementById('speed10Btn');
  
  // 进度条元素
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const uploadProgressText = document.getElementById('uploadProgressText');
  
  // BPM检测相关元素
  const detectBpmBtn = document.createElement('button');
  detectBpmBtn.id = 'detectBpmBtn';
  detectBpmBtn.className = 'btn btn-info';
  detectBpmBtn.textContent = '检测BPM';
  detectBpmBtn.disabled = true;
  
  // 添加BPM检测按钮到DOM中
  const bpmInputContainer = bpmInput.parentNode;
  bpmInputContainer.appendChild(document.createTextNode(' '));
  bpmInputContainer.appendChild(detectBpmBtn);
  
  // 谱面编辑器元素
  const beatInput = document.getElementById('beatInput');
  const generateGridBtn = document.getElementById('generateGridBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const trackEditor = document.getElementById('trackEditor');
  const tracks = [
    document.getElementById('track0'),
    document.getElementById('track1'),
    document.getElementById('track2'),
    document.getElementById('track3')
  ];
  const editorTimeline = document.getElementById('editorTimeline');
  
  // 添加生成JSON按钮
  const generateJsonBtn = document.createElement('button');
  generateJsonBtn.id = 'generateJsonBtn';
  generateJsonBtn.className = 'game-btn';
  generateJsonBtn.innerHTML = '<i class="fas fa-code"></i> 生成谱面JSON';
  generateJsonBtn.disabled = true;
  
  // 将生成JSON按钮添加到操作区域
  const actionSection = document.querySelector('.action-section');
  if (actionSection) {
    actionSection.insertBefore(generateJsonBtn, saveBtn);
  }
  
  // 状态变量
  let wavesurfer;
  let uploadedFile = null;
  let scoreData = null;
  let isPlaying = false;
  let audioContext = null;
  let audioBuffer = null;
  let selectedNotes = []; // 存储最近选中的音符
  let notesCounter = 0; // 音符计数器
  let lastSelectedTrack = null; // 最近选中的轨道
  let lastSelectedTime = null; // 最近选中的时间
  let playbackRate = 1.0; // 播放速度倍率，默认为1.0
  let keyboardEnabled = false; // 键盘控制是否启用
  
  // 初始化Web Audio API上下文
  function initAudioContext() {
    try {
      // 确保使用正确的构造函数名称和延迟初始化
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      
      if (!AudioContextClass) {
        debugLog('无法找到AudioContext构造函数');
        return false;
      }
      
      // 只有在需要时才创建AudioContext
      if (!audioContext) {
        audioContext = new AudioContextClass();
        debugLog('AudioContext初始化成功');
      }
      
      return true;
    } catch(e) {
      debugLog('AudioContext初始化失败:', e);
      return false;
    }
  }

  // 初始化WaveSurfer
  function initWaveSurfer() {
    if (wavesurfer) {
      wavesurfer.destroy();
    }
    
    wavesurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#3498db',
      progressColor: '#2980b9',
      responsive: true,
      cursorColor: '#e74c3c',
      barWidth: 2,
      barHeight: 1,
      barGap: null,
      height: 150
    });

    wavesurfer.on('ready', function() {
      debugLog('音频加载完成');
      playBtn.disabled = false;
      pauseBtn.disabled = false;
      detectBpmBtn.disabled = false; // 启用BPM检测按钮
      
      // 设置初始播放速度
      setPlaybackRate(playbackRate);
      
      // 初始化空白谱面
      initEmptyScore();
      
      // 启用键盘控制
      keyboardEnabled = true;
      
      // 启用生成JSON按钮
      generateJsonBtn.disabled = false;
    });

    wavesurfer.on('finish', function() {
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      isPlaying = false;
    });
    
    // 添加错误处理
    wavesurfer.on('error', function(err) {
      debugLog('Wavesurfer错误:', err);
      uploadInfo.innerHTML += '<br><span style="color: red;">音频加载失败，请尝试重新上传</span>';
    });
  }

  // 更新进度条函数
  function updateProgressBar(progressBar, progressText, value) {
    const percent = Math.round(value * 100);
    progressBar.style.width = percent + '%';
    progressText.textContent = percent + '%';
  }

  // 初始化空白谱面
  function initEmptyScore() {
    if (!wavesurfer) return;
    
    const songName = uploadedFile ? 
      uploadedFile.originalname.replace(/\.[^/.]+$/, "") : 
      "未命名歌曲";
    
    scoreData = {
      name: songName,
      iamgePath: "",
      musicPath: uploadedFile ? `/uploads/${uploadedFile.filename}` : "",
      difficulty: parseInt(difficultyInput.value) || 3,
      BPM: parseInt(bpmInput.value) || 120,
      offset: parseInt(offsetInput.value) || 0,
      track: {}
    };
    
    // 不再实时显示JSON预览
    jsonContent.textContent = "点击「生成谱面JSON」按钮来生成谱面数据";
    
    // 启用保存按钮
    saveBtn.disabled = false;
    
    // 清空所有音轨
    tracks.forEach(track => track.innerHTML = '');
    selectedNotes = [];
    notesCounter = 0;
    lastSelectedTrack = null;
    lastSelectedTime = null;
  }

  // 使用Web Audio API和bpm-detective库分析音频文件并检测BPM
  function detectBPM(audioFile) {
    return new Promise((resolve, reject) => {
      try {
        if (!initAudioContext()) {
          return reject(new Error('无法初始化音频上下文'));
        }
        
        debugLog('开始读取音频文件数据');
        const reader = new FileReader();
        
        reader.onload = async function(e) {
          try {
            const fileBuffer = e.target.result;
            
            debugLog('解码音频数据...');
            audioContext.decodeAudioData(fileBuffer, 
              (audioBuffer) => {
                try {
                  debugLog('音频解码成功，开始分析BPM...');
                  
                  // 获取音频原始数据
                  const channelData = audioBuffer.getChannelData(0); // 使用第一个声道的数据
                  
                  // 验证音频参数
                  const sampleRate = audioBuffer.sampleRate;
                  const numberOfChannels = audioBuffer.numberOfChannels;
                  const duration = audioBuffer.duration;
                  
                  debugLog('音频信息:', {
                    sampleRate,
                    numberOfChannels,
                    duration,
                    dataLength: channelData.length
                  });
                  
                  // 检查参数是否有效
                  if (!isFinite(sampleRate) || sampleRate <= 0) {
                    throw new Error('无效的采样率: ' + sampleRate);
                  }
                  
                  if (!channelData || channelData.length === 0) {
                    throw new Error('无效的音频数据');
                  }
                  
                  // 使用try-catch单独包装BPM检测调用
                  try {
                    // 使用bpm-detective库检测BPM
                    const bpm = window.DetectBPM(channelData, {
                      sampleRate: audioBuffer.sampleRate
                    });
                    debugLog('BPM检测结果:', bpm);
                    resolve(bpm);
                  } catch (bpmError) {
                    debugLog('DetectBPM调用失败:', bpmError);
                    
                    // 尝试直接分析，避免库内部的OfflineAudioContext创建
                    const bpmRange = estimateBPMRange(channelData, sampleRate);
                    debugLog('使用备用方法估算BPM范围:', bpmRange);
                    resolve(bpmRange.avgBPM);
                  }
                } catch (analyzeError) {
                  debugLog('BPM分析失败:', analyzeError);
                  reject(analyzeError);
                }
              },
              (decodeError) => {
                debugLog('音频解码失败:', decodeError);
                reject(decodeError);
              }
            );
          } catch (processError) {
            debugLog('处理音频文件失败:', processError);
            reject(processError);
          }
        };
        
        reader.onerror = function(readerError) {
          debugLog('读取文件失败:', readerError);
          reject(readerError);
        };
        
        reader.readAsArrayBuffer(audioFile);
      } catch (error) {
        debugLog('检测BPM过程出错:', error);
        reject(error);
      }
    });
  }
  
  // 简单的BPM估算函数，当主要库方法失败时作为备选
  function estimateBPMRange(audioData, sampleRate) {
    debugLog('使用简单算法估算BPM...');
    
    // 1. 提取峰值
    const threshold = 0.8;
    const peaks = [];
    
    // 简单地找出超过阈值的峰值
    for (let i = 0; i < audioData.length; i++) {
      if (Math.abs(audioData[i]) > threshold) {
        peaks.push(i);
        // 跳过一小段时间以避免连续峰值
        i += sampleRate / 20; // 约50ms
      }
    }
    
    debugLog('找到峰值数量:', peaks.length);
    
    if (peaks.length < 10) {
      // 如果峰值太少，返回默认值
      return { minBPM: 100, maxBPM: 140, avgBPM: 120 };
    }
    
    // 2. 计算间隔
    const intervals = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      const interval = peaks[i + 1] - peaks[i];
      if (interval > 0) {
        intervals.push(interval);
      }
    }
    
    // 3. 将间隔转换为BPM
    const bpmValues = intervals.map(interval => {
      const bpm = 60 / (interval / sampleRate);
      
      // 调整BPM到通常的范围(60-200)
      let adjustedBPM = bpm;
      while (adjustedBPM < 60) adjustedBPM *= 2;
      while (adjustedBPM > 200) adjustedBPM /= 2;
      
      return adjustedBPM;
    });
    
    // 4. 获取BPM范围和平均值
    const validBPMs = bpmValues.filter(bpm => !isNaN(bpm) && isFinite(bpm));
    
    if (validBPMs.length === 0) {
      return { minBPM: 100, maxBPM: 140, avgBPM: 120 };
    }
    
    const minBPM = Math.min(...validBPMs);
    const maxBPM = Math.max(...validBPMs);
    const avgBPM = Math.round(validBPMs.reduce((sum, bpm) => sum + bpm, 0) / validBPMs.length);
    
    return { minBPM, maxBPM, avgBPM };
  }

  // 上传音乐文件
  uploadBtn.addEventListener('click', function() {
    if (!musicFileInput.files.length) {
      uploadInfo.innerHTML = '<span style="color: red;">请选择一个音乐文件</span>';
      return;
    }

    const file = musicFileInput.files[0];
    debugLog('准备上传文件:', file.name, '类型:', file.type, '大小:', file.size);
    
    const formData = new FormData();
    formData.append('music', file);
    formData.append('bpm', document.getElementById('bpmInput').value);
    formData.append('offset', document.getElementById('offsetInput').value);
    formData.append('difficulty', document.getElementById('difficultyInput').value);

    uploadInfo.textContent = '准备上传...';
    uploadProgressContainer.style.display = 'block';
    updateProgressBar(uploadProgressBar, uploadProgressText, 0);
    
    // 使用XMLHttpRequest来监控上传进度
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', function(e) {
      if (e.lengthComputable) {
        const progress = e.loaded / e.total;
        updateProgressBar(uploadProgressBar, uploadProgressText, progress);
      }
    });
    
    xhr.addEventListener('load', function() {
      debugLog('上传完成, 状态:', xhr.status, '响应:', xhr.responseText);
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          debugLog('解析上传响应:', response);
          
          if (response.success && response.file) {
            uploadedFile = response.file;
            
            uploadInfo.innerHTML = `
              <strong>上传成功!</strong><br>
              文件名: ${uploadedFile.originalname}<br>
              大小: ${Math.round(uploadedFile.size / 1024)} KB<br>
              类型: ${uploadedFile.mimetype}
            `;
            
            debugLog('初始化音频播放器, 文件:', uploadedFile.filename);
            initWaveSurfer();
            const audioUrl = `/uploads/${uploadedFile.filename}`;
            debugLog('加载音频URL:', audioUrl);
            wavesurfer.load(audioUrl);
            
            // 尝试自动检测BPM
            detectBPM(file)
              .then(bpm => {
                const detectedBpm = Math.round(bpm);
                debugLog('BPM检测结果:', detectedBpm);
                bpmInput.value = detectedBpm;
                uploadInfo.innerHTML += `<br><span style="color: green;">检测到BPM: ${detectedBpm}</span>`;
                
                // 更新BPM信息显示和推荐节拍分割
                updateBpmInfo();
                
                // 自动推荐最佳节拍分割
                const recommendedBeatType = getRecommendedBeatType(detectedBpm);
                debugLog(`推荐的节拍分割: ${recommendedBeatType}分音符`);
                
                // 显示推荐提示
                uploadInfo.innerHTML += `<br><span style="color: #03dac6;">推荐节拍分割: ${recommendedBeatType}分音符 
                  <button id="applyRecommendationBtn" class="small-btn">应用推荐</button></span>`;
                
                // 添加点击事件
                setTimeout(() => {
                  const applyBtn = document.getElementById('applyRecommendationBtn');
                  if (applyBtn) {
                    applyBtn.addEventListener('click', function() {
                      beatInput.value = recommendedBeatType;
                      updateBpmInfo();
                      uploadInfo.innerHTML += `<br><span style="color: green;">已应用推荐的节拍分割: ${recommendedBeatType}分音符</span>`;
                    });
                  }
                }, 100); // 使用setTimeout确保DOM已更新
              })
              .catch(error => {
                debugLog('自动BPM检测失败:', error);
              });
            
            // 2秒后隐藏进度条
            setTimeout(() => {
              uploadProgressContainer.style.display = 'none';
            }, 2000);
          } else {
            throw new Error(response.error || '上传失败');
          }
        } catch (error) {
          debugLog('解析响应失败:', error, '原始响应:', xhr.responseText);
          uploadInfo.innerHTML = '<span style="color: red;">解析响应失败: ' + error.message + '</span>';
          uploadProgressContainer.style.display = 'none';
        }
      } else {
        debugLog('上传HTTP错误:', xhr.status, xhr.statusText);
        uploadInfo.innerHTML = '<span style="color: red;">上传失败: ' + xhr.statusText + '</span>';
        uploadProgressContainer.style.display = 'none';
      }
    });
    
    xhr.addEventListener('error', function(e) {
      debugLog('上传网络错误:', e);
      uploadInfo.innerHTML = '<span style="color: red;">上传失败: 网络错误</span>';
      uploadProgressContainer.style.display = 'none';
    });
    
    xhr.addEventListener('abort', function() {
      debugLog('上传已取消');
      uploadInfo.innerHTML = '<span style="color: orange;">上传已取消</span>';
      uploadProgressContainer.style.display = 'none';
    });
    
    debugLog('开始上传请求');
    xhr.open('POST', '/upload', true);
    xhr.send(formData);
  });

  // 手动检测BPM
  detectBpmBtn.addEventListener('click', function() {
    if (!uploadedFile || !musicFileInput.files.length) {
      uploadInfo.innerHTML += '<br><span style="color: red;">请先上传音频文件</span>';
      return;
    }
    
    const file = musicFileInput.files[0];
    
    // 禁用按钮，显示检测中状态
    detectBpmBtn.disabled = true;
    detectBpmBtn.textContent = '检测中...';
    uploadInfo.innerHTML += '<br><span style="color: blue;">BPM检测中，请稍等...</span>';
    
    // 使用Web Audio API检测BPM
    detectBPM(file)
      .then(bpm => {
        detectBpmBtn.textContent = '检测BPM';
        detectBpmBtn.disabled = false;
        
        const detectedBpm = Math.round(bpm);
        debugLog('BPM检测结果:', detectedBpm);
        
        // 更新BPM输入框
        bpmInput.value = detectedBpm;
        
        // 显示检测结果
        uploadInfo.innerHTML += `<br><span style="color: green;">BPM检测完成: ${detectedBpm}</span>`;
        
        // 更新BPM信息
        updateBpmInfo();
        
        // 自动推荐最佳节拍分割
        const recommendedBeatType = getRecommendedBeatType(detectedBpm);
        debugLog(`推荐的节拍分割: ${recommendedBeatType}分音符`);
        
        // 显示推荐提示
        uploadInfo.innerHTML += `<br><span style="color: #03dac6;">推荐节拍分割: ${recommendedBeatType}分音符 
          <button id="applyRecommendationBtn" class="small-btn">应用推荐</button></span>`;
        
        // 添加点击事件
        setTimeout(() => {
          const applyBtn = document.getElementById('applyRecommendationBtn');
          if (applyBtn) {
            applyBtn.addEventListener('click', function() {
              beatInput.value = recommendedBeatType;
              updateBpmInfo();
              uploadInfo.innerHTML += `<br><span style="color: green;">已应用推荐的节拍分割: ${recommendedBeatType}分音符</span>`;
            });
          }
        }, 100); // 使用setTimeout确保DOM已更新
      })
      .catch(error => {
        debugLog('BPM检测请求错误:', error);
        detectBpmBtn.textContent = '检测BPM';
        detectBpmBtn.disabled = false;
        uploadInfo.innerHTML += '<br><span style="color: red;">BPM检测失败，错误原因: ' + error.message + '</span>';
      });
  });

  // 设置播放速度函数
  function setPlaybackRate(rate) {
    if (!wavesurfer) return;
    
    // 更新播放速度状态
    playbackRate = rate;
    
    // 设置音频播放速度
    wavesurfer.setPlaybackRate(rate);
    
    // 更新UI
    speed05Btn.classList.toggle('active', rate === 0.5);
    speed10Btn.classList.toggle('active', rate === 1.0);
    
    debugLog(`播放速度设置为: ${rate}x`);
  }
  
  // 0.5倍速按钮点击事件
  speed05Btn.addEventListener('click', function() {
    setPlaybackRate(0.5);
  });
  
  // 1.0倍速按钮点击事件
  speed10Btn.addEventListener('click', function() {
    setPlaybackRate(1.0);
  });

  // 播放控制
  playBtn.addEventListener('click', function() {
    // 更新BPM信息显示
    updateBpmInfo();
    
    wavesurfer.play();
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    isPlaying = true;
    
    // 开始更新时间线
    updateEditorTimeline();
    
    debugLog(`播放开始，使用BPM: ${bpmInput.value}，速度: ${playbackRate}x`);
  });

  pauseBtn.addEventListener('click', function() {
    wavesurfer.pause();
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    isPlaying = false;
  });
  
  // 获取当前时间线位置对应的格子
  function getCurrentGridAtTimeline() {
    if (!isPlaying || !wavesurfer) return null;
    
    // 获取当前播放时间
    const currentTime = wavesurfer.getCurrentTime() * 1000; // 转换为毫秒
    
    // 获取BPM和节拍信息
    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    
    // 计算格子时长
    const gridDuration = (60 / bpm) * 1000 / (beatType / 4);
    
    // 计算当前时间对应的格子索引
    const gridIndex = Math.floor(currentTime / gridDuration);
    
    return gridIndex;
  }
  
  // 在指定轨道和当前时间线位置添加/删除音符
  function toggleNoteAtTimeline(trackIndex, shouldRemove = false) {
    if (!isPlaying || !wavesurfer || trackIndex < 0 || trackIndex > 3) return;
    
    // 获取当前格子索引
    const gridIndex = getCurrentGridAtTimeline();
    if (gridIndex === null) return;
    
    // 获取对应轨道
    const track = tracks[trackIndex];
    if (!track) return;
    
    // 查找对应的格子元素
    const grids = Array.from(track.children);
    const targetGrid = grids.find(grid => parseInt(grid.dataset.index) === gridIndex);
    
    if (targetGrid) {
      // 高亮显示当前操作的格子
      const oldBackgroundColor = targetGrid.style.backgroundColor;
      targetGrid.style.backgroundColor = shouldRemove ? '#ff6b6b' : '#6bff6b';
      
      // 延迟恢复原来的颜色，提供视觉反馈
      setTimeout(() => {
        targetGrid.style.backgroundColor = oldBackgroundColor;
      }, 200);
      
      // 获取格子的时间和轨道信息
      const time = parseInt(targetGrid.dataset.time);
      
      // 如果是删除操作且格子已激活，或者是添加操作且格子未激活，则切换状态
      if ((shouldRemove && targetGrid.classList.contains('active')) || 
          (!shouldRemove && !targetGrid.classList.contains('active'))) {
        // 使用已有的toggleGridSelection函数来处理添加/删除音符
        toggleGridSelection(targetGrid, trackIndex, gridIndex, time);
        
        debugLog(`${shouldRemove ? '删除' : '添加'}音符: 轨道=${trackIndex+1}, 索引=${gridIndex}, 时间=${time}ms`);
      }
    } else {
      debugLog(`未找到轨道${trackIndex+1}上索引为${gridIndex}的格子`);
    }
  }
  
  // 添加键盘事件监听
  document.addEventListener('keydown', function(event) {
    // 只有在键盘控制启用且音频正在播放时才处理键盘事件
    if (!keyboardEnabled || !isPlaying) return;
    
    // 检查是否按下了Shift键
    const isShiftPressed = event.shiftKey;
    
    // 根据按键触发相应的轨道操作
    switch(event.key.toLowerCase()) {
      case 'q': // 轨道1
        toggleNoteAtTimeline(0, isShiftPressed);
        break;
      case 'w': // 轨道2
        toggleNoteAtTimeline(1, isShiftPressed);
        break;
      case 'e': // 轨道3
        toggleNoteAtTimeline(2, isShiftPressed);
        break;
      case 'r': // 轨道4
        toggleNoteAtTimeline(3, isShiftPressed);
        break;
    }
  });

  // 更新编辑器时间线位置
  function updateEditorTimeline() {
    if (!wavesurfer || !isPlaying) return;

    const currentTime = wavesurfer.getCurrentTime();
    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    
    // 1. 计算每个格子的持续时间（秒）
    const singleBeatDuration = 60 / bpm;
    const gridDuration = singleBeatDuration / (beatType / 4);

    // 2. 计算当前时间应该在哪个格子上
    const gridIndex = currentTime / gridDuration;

    // 3. 计算时间线在屏幕上的像素位置
    // 每个格子的宽度固定为50px
    const gridWidth = 50; 
    const timelinePosition = gridIndex * gridWidth;
    
    // 4. 获取容器信息
    const trackContainer = tracks[0]; // 以第一个轨道容器为基准
    if (!trackContainer) return;
    
    const containerWidth = trackContainer.clientWidth;
    const centerPosition = containerWidth / 2;
    
    // 5. 固定进度条在中心位置
    // 不再更新进度条的left属性，而是将其固定在中央
    editorTimeline.style.left = `${centerPosition}px`;
    
    // 6. 计算轨道应该滚动的位置
    // 目标：让轨道内容随着播放向左滚动，使得当前播放位置始终在中心
    const targetScrollLeft = timelinePosition - centerPosition;
    
    // 确保滚动位置不为负
    const finalScrollLeft = Math.max(0, targetScrollLeft);
    
    // 7. 应用滚动 - 直接设置滚动位置，确保与播放位置同步
    // 根据播放速度调整滚动速度，保持与音频同步
    applyScrollToTracks(finalScrollLeft);

    // 8. 持续更新
    if (isPlaying) {
      requestAnimationFrame(updateEditorTimeline);
    }
  }
  
  // 将滚动应用到所有轨道
  function applyScrollToTracks(scrollLeft) {
    tracks.forEach(track => {
      track.scrollLeft = scrollLeft;
    });
  }

  // 显示BPM相关信息
  function updateBpmInfo() {
    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    
    // 计算一拍的时长（毫秒），根据当前的播放速度调整
    const beatDuration = (60 / bpm) * 1000 / playbackRate;
    const gridDuration = beatDuration / (beatType / 4);
    
    // 根据BPM推荐分割节拍
    const recommendedBeatType = getRecommendedBeatType(bpm);
    const recommendationText = recommendedBeatType !== beatType ? 
      `<span style="color: #03dac6; cursor: pointer;" id="applyRecommendedBeat">推荐使用 ${recommendedBeatType}分音符 (点击应用)</span>` : 
      `<span style="color: #03dac6;">当前节拍分割最佳</span>`;
    
    // 更新BPM信息显示
    const bpmInfoElement = document.getElementById('bpmInfo') || document.createElement('div');
    bpmInfoElement.id = 'bpmInfo';
    bpmInfoElement.style.marginTop = '5px';
    bpmInfoElement.style.fontSize = '12px';
    bpmInfoElement.style.color = '#888';
    
    bpmInfoElement.innerHTML = `
      <span>BPM: ${bpm} - 每拍 ${beatDuration.toFixed(0)}ms - 每格 ${gridDuration.toFixed(0)}ms (${playbackRate}x速度)</span>
      <span style="margin-left:10px;">滚动速度: ${bpm < 100 ? '慢' : bpm < 150 ? '中' : '快'}</span><br>
      ${recommendationText}
    `;
    
    if (!document.getElementById('bpmInfo')) {
      bpmInput.parentNode.appendChild(bpmInfoElement);
    }
    
    // 添加点击事件处理程序
    const applyRecommendedBtn = document.getElementById('applyRecommendedBeat');
    if (applyRecommendedBtn) {
      applyRecommendedBtn.onclick = function() {
        beatInput.value = recommendedBeatType;
        updateBpmInfo(); // 更新显示
        debugLog(`应用推荐的节拍分割: ${recommendedBeatType}`);
      };
    }
  }
  
  // 基于BPM推荐节拍分割
  function getRecommendedBeatType(bpm) {
    // 根据BPM范围推荐不同的节拍分割方式
    if (bpm < 70) {
      // 非常慢的歌曲，推荐更细的分割
      return 32;
    } else if (bpm < 90) {
      // 慢歌，推荐16分音符
      return 16;
    } else if (bpm < 120) {
      // 中速歌曲，推荐8分音符
      return 8;
    } else if (bpm < 160) {
      // 较快歌曲，推荐4分音符
      return 4;
    } else {
      // 非常快的歌曲，可以用4分音符
      return 4;
    }
  }
  
  // BPM输入框变更事件
  bpmInput.addEventListener('change', function() {
    updateBpmInfo();
  });
  
  // 生成格子
  generateGridBtn.addEventListener('click', function() {
    if (!wavesurfer || !scoreData) {
      alert('请先上传音乐文件');
      return;
    }
    
    // 清空所有音轨
    tracks.forEach(track => track.innerHTML = '');
    selectedNotes = [];
    notesCounter = 0;
    lastSelectedTrack = null;
    lastSelectedTime = null;
    
    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    const songDuration = wavesurfer.getDuration(); // 获取歌曲总时长（秒）
    
    // 计算一拍的时长（毫秒）
    const beatDuration = (60 / bpm) * 1000;
    
    // 基于节拍类型计算一个格子代表的时间（以毫秒为单位）
    const gridDuration = beatDuration / (beatType / 4);
    
    // 计算需要的总格子数（确保足够多的格子覆盖整个音频）
    const totalGrids = Math.ceil((songDuration * 1000) / gridDuration) + 8; // 多加一些格子以确保完全覆盖
    
    debugLog(`生成格子: BPM=${bpm}, 拍子=${beatType}, 总时长=${songDuration}秒, 格子数=${totalGrids}, 每格时长=${gridDuration}ms`);
    
    // 更新BPM信息显示
    updateBpmInfo();
    
    // 为每条轨道生成格子
    tracks.forEach((track, trackIndex) => {
      for (let i = 0; i < totalGrids; i++) {
        const grid = document.createElement('div');
        grid.className = 'track-grid';
        grid.dataset.time = Math.floor(i * gridDuration);
        grid.dataset.index = i;
        grid.dataset.track = trackIndex;
        
        // 每四个格子添加一个视觉标记
        if (i % 4 === 0) {
          grid.style.borderRight = '1px solid rgba(255, 255, 255, 0.4)';
          // 添加节拍数字标记
          if (i % 16 === 0) {
            const beatNum = i / 4;
            grid.innerHTML = `<small style="opacity: 0.7; position: absolute; bottom: 2px; left: 2px;">${beatNum}</small>`;
          }
        }
        
        // 添加点击事件
        grid.addEventListener('click', function() {
          toggleGridSelection(grid, trackIndex, i, Math.floor(i * gridDuration));
        });
        
        track.appendChild(grid);
      }
    });
    
    // 初始化时间线位置 - 设置到中央
    const trackContainer = tracks[0];
    if (trackContainer) {
      const containerWidth = trackContainer.clientWidth;
      const centerPosition = containerWidth / 2;
      editorTimeline.style.left = `${centerPosition}px`;
    } else {
      editorTimeline.style.left = '50%'; // 默认回退值
    }
    
    // 确保轨道可以水平滚动
    tracks.forEach(track => {
      // 双击轨道区域自动滚动到开始位置
      track.addEventListener('dblclick', function() {
        track.scrollLeft = 0;
      });
      
      // 确保滚动条显示
      track.style.overflowX = 'auto';
    });
    
    // 启用键盘控制
    keyboardEnabled = true;
    
    // 添加键盘控制提示
    const keyboardTips = document.createElement('div');
    keyboardTips.className = 'keyboard-tips';
    keyboardTips.innerHTML = `
      <div class="tips-header">键盘快捷键:</div>
      <div class="tips-content">
        <div><span class="key">Q</span> - 音轨1添加音符</div>
        <div><span class="key">W</span> - 音轨2添加音符</div>
        <div><span class="key">E</span> - 音轨3添加音符</div>
        <div><span class="key">R</span> - 音轨4添加音符</div>
        <div><span class="key">Shift+Q/W/E/R</span> - 删除对应轨道音符</div>
      </div>
    `;
    
    // 添加到编辑器区域
    const editorSection = document.querySelector('.editor-section .panel-content');
    if (editorSection && !document.querySelector('.keyboard-tips')) {
      editorSection.appendChild(keyboardTips);
    }
  });
  
  // 切换格子选择状态
  function toggleGridSelection(grid, trackIndex, index, time) {
    // 已经激活，则取消激活
    if (grid.classList.contains('active')) {
      grid.classList.remove('active', 'selected', 'long-note'); // 同时移除长音符样式
      
      // 如果是长音符的一部分，需要处理特殊情况
      if (grid.dataset.noteId) {
        const noteId = grid.dataset.noteId;
        const noteData = scoreData.track[noteId];
        
        // 如果是长音符(type=2)，需要移除所有相关格子的样式
        if (noteData && noteData.type === '2') {
          // 查找所有与这个长音符相关的格子
          const trackElement = tracks[trackIndex];
          const allGrids = Array.from(trackElement.children);
          
          allGrids.forEach(otherGrid => {
            if (otherGrid.dataset.noteId === noteId) {
              otherGrid.classList.remove('active', 'selected', 'long-note');
              delete otherGrid.dataset.noteId;
            }
          });
        }
        
        // 从谱面数据中移除
        removeNoteFromScore(noteId);
        delete grid.dataset.noteId;
      }
      
      // 重置状态
      selectedNotes = [];
      lastSelectedTrack = null;
      lastSelectedTime = null;
    } else {
      // 激活格子
      grid.classList.add('active');
      
      // 创建新音符并添加到谱面
      const noteId = 'note' + (++notesCounter);
      const noteData = {
        time: time,
        type: '1', // 默认为短音符
        color: trackIndex,
        begin: time,
        end: time + 100 // 默认短音符长度为100ms
      };
      
      // 标记格子属于哪个音符
      grid.dataset.noteId = noteId;
      
      // 更新谱面数据
      updateScoreWithNote(noteId, noteData);
      
      // 添加到选中列表
      const newNote = {
        element: grid,
        noteId: noteId,
        trackIndex: trackIndex,
        index: parseInt(index),
        time: time
      };
      selectedNotes.push(newNote);
      
      // 检测是否可以自动合并
      if (lastSelectedTrack === trackIndex && lastSelectedTime !== null) {
        // 计算时间间隔
        const gridDuration = calculateGridDuration();
        const expectedTime = lastSelectedTime + gridDuration;
        
        // 如果是连续的格子（允许小误差），尝试合并
        if (Math.abs(time - expectedTime) < gridDuration * 0.1) {
          // 查找上一个相邻的音符
          const prevGrid = findAdjacentGrid(trackIndex, index - 1);
          if (prevGrid && prevGrid.classList.contains('active')) {
            // 找到前一个激活的格子，执行合并
            autoMergeWithAdjacent(newNote, trackIndex, prevGrid);
          }
        }
      }
      
      // 更新最近选中的轨道和时间
      lastSelectedTrack = trackIndex;
      lastSelectedTime = time;
    }
  }
  
  // 查找相邻格子
  function findAdjacentGrid(trackIndex, index) {
    const track = tracks[trackIndex];
    if (!track) return null;
    
    const grids = Array.from(track.children);
    return grids.find(g => parseInt(g.dataset.index) === index);
  }
  
  // 与相邻格子合并
  function autoMergeWithAdjacent(currentNote, trackIndex, adjacentGrid) {
    if (!adjacentGrid || !adjacentGrid.dataset.noteId) return;
    
    const adjacentNoteId = adjacentGrid.dataset.noteId;
    const adjacentNoteData = scoreData.track[adjacentNoteId];
    
    if (!adjacentNoteData) return;
    
    // 创建长音符
    const longNoteId = 'note' + (++notesCounter);
    const longNoteData = {
      time: Math.min(currentNote.time, adjacentNoteData.time),
      type: '2', // 长音符
      color: trackIndex,
      begin: Math.min(currentNote.time, adjacentNoteData.time),
      end: Math.max(
        currentNote.time + 100, 
        adjacentNoteData.time + (adjacentNoteData.type === '2' ? 
          (adjacentNoteData.end - adjacentNoteData.time) : 100)
      )
    };
    
    // 从谱面中移除原有音符
    removeNoteFromScore(currentNote.noteId);
    removeNoteFromScore(adjacentNoteId);
    
    // 添加长音符到谱面
    updateScoreWithNote(longNoteId, longNoteData);
    
    // 更新两个格子的视觉效果
    currentNote.element.classList.add('long-note');
    currentNote.element.dataset.noteId = longNoteId;
    
    adjacentGrid.classList.add('long-note');
    adjacentGrid.dataset.noteId = longNoteId;
    
    // 查找两个格子之间的所有格子（如果是合并较远的音符）
    const minIndex = Math.min(currentNote.index, parseInt(adjacentGrid.dataset.index));
    const maxIndex = Math.max(currentNote.index, parseInt(adjacentGrid.dataset.index));
    
    if (maxIndex - minIndex > 1) {
      const trackElement = tracks[trackIndex];
      const allGrids = Array.from(trackElement.children);
      
      // 找到中间的所有格子并标记为长音符的一部分
      allGrids.forEach(grid => {
        const gridIndex = parseInt(grid.dataset.index);
        if (gridIndex > minIndex && gridIndex < maxIndex) {
          grid.classList.add('long-note');
          grid.dataset.noteId = longNoteId;
        }
      });
    }
    
    // 更新选中的音符
    selectedNotes = [
      {
        element: currentNote.element,
        noteId: longNoteId,
        trackIndex: trackIndex,
        index: currentNote.index,
        time: currentNote.time
      }
    ];
  }
  
  // 计算格子时长
  function calculateGridDuration() {
    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    // 考虑当前播放速度对格子时长的影响
    return (60 / bpm) * 1000 / (beatType / 4) / playbackRate;
  }
  
  // 自动合并最后选择的音符
  function autoMergeLastNotes() {
    if (selectedNotes.length < 2) return;
    
    // 获取最后两个选中的音符
    const lastNote = selectedNotes[selectedNotes.length - 1];
    const prevNote = selectedNotes[selectedNotes.length - 2];
    
    // 检查是否在同一轨道
    if (lastNote.trackIndex !== prevNote.trackIndex) return;
    
    // 检查是否相邻或足够近
    const gridDuration = calculateGridDuration();
    const timeDiff = Math.abs(lastNote.time - prevNote.time);
    
    if (timeDiff <= gridDuration * 1.1) { // 允许10%的误差
      // 在同一轨道上的相邻音符，可以合并
      autoMergeWithAdjacent(
        lastNote,
        lastNote.trackIndex,
        prevNote.element
      );
    }
  }
  
  // 从谱面中移除音符
  function removeNoteFromScore(noteId) {
    if (scoreData && scoreData.track && noteId) {
      delete scoreData.track[noteId];
      // 不再每次都更新JSON预览
    }
  }
  
  // 更新谱面数据中的音符
  function updateScoreWithNote(noteId, noteData) {
    if (scoreData && scoreData.track) {
      scoreData.track[noteId] = noteData;
      // 不再每次都更新JSON预览
    }
  }
  
  // 生成并更新JSON预览
  function generateJsonPreview() {
    if (!jsonContent || !scoreData) return;
    
    try {
      const notesArr = Object.values(scoreData.track || {})
        .map(note => {
          const duration = (note.end !== undefined && note.begin !== undefined)
            ? (note.end - note.begin)
            : 0;
          return {
            time: note.time,
            type: note.type,
            color: note.color,
            duration: duration
          };
        })
        .sort((a, b) => a.time - b.time);

      const trackCount = notesArr.length;

      const previewData = {
        name: scoreData.name,
        trackCount: trackCount,
        iamgePath: scoreData.iamgePath,
        musicPath: scoreData.musicPath,
        difficulty: parseInt(difficultyInput.value) || 3,
        BPM: parseInt(bpmInput.value) || 120,
        offset: parseInt(offsetInput.value) || 0,
        track: notesArr
      };
      
      // 格式化JSON并显示
      jsonContent.textContent = JSON.stringify(previewData, null, 2);
      
      // 显示成功消息
      const jsonSection = document.getElementById('jsonPreview');
      if (jsonSection) {
        const notification = document.createElement('div');
        notification.className = 'json-notification';
        notification.textContent = '谱面JSON已成功生成！';
        jsonSection.querySelector('.panel-content').appendChild(notification);
        setTimeout(() => { notification.remove(); }, 3000);
      }
      return previewData;
    } catch (e) {
      debugLog('生成JSON预览出错:', e);
      jsonContent.textContent = '生成JSON失败: ' + e.message;
      return null;
    }
  }
  
  // 生成JSON按钮点击事件
  generateJsonBtn.addEventListener('click', function() {
    if (!scoreData) {
      alert('请先上传音乐文件并编辑谱面');
      return;
    }
    
    // 在生成预览前，先执行全局的自动合并
    autoMergeAllNotes();
    
    // 生成JSON预览
    const jsonData = generateJsonPreview();
    
    if (jsonData) {
      debugLog('谱面JSON已生成:', jsonData);
      
      // 滚动到JSON预览区域
      const jsonSection = document.getElementById('jsonPreview');
      if (jsonSection) {
        jsonSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
  
  // 保存按钮事件
  saveBtn.addEventListener('click', function() {
    if (!scoreData) {
      alert('请先生成谱面');
      return;
    }
    
    // 先生成最新的JSON数据
    const jsonData = generateJsonPreview();
    if (!jsonData) {
      alert('生成JSON数据失败，请重试');
      return;
    }
    
    // 使用fetch API发送保存请求
    fetch('/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jsonData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`保存失败: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        debugLog('保存成功:', data);
        
        // 更新下载按钮
        if (data.downloadUrl) {
          downloadBtn.disabled = false;
          downloadBtn.style.display = 'inline-flex';
          downloadBtn.onclick = function() {
            window.location.href = data.downloadUrl;
          };
          
          // 显示成功消息
          alert(`谱面已成功保存为 ${data.filename}`);
        }
      } else {
        throw new Error(data.error || '保存失败');
      }
    })
    .catch(error => {
      debugLog('保存谱面失败:', error);
      alert('保存谱面失败: ' + error.message);
    });
  });
  
  // 清空谱面按钮事件
  clearAllBtn.addEventListener('click', function() {
    if (!confirm('确定要清空所有音符?')) return;
    
    // 清空所有音轨
    tracks.forEach(track => {
      Array.from(track.children).forEach(grid => {
        grid.classList.remove('active', 'selected', 'long-note');
        delete grid.dataset.noteId;
      });
    });
    
    // 重置谱面数据
    if (scoreData) {
      scoreData.track = {};
      // 不再自动更新JSON预览
      jsonContent.textContent = "点击「生成谱面JSON」按钮来生成谱面数据";
    }
    
    // 重置状态
    selectedNotes = [];
    notesCounter = 0;
    lastSelectedTrack = null;
    lastSelectedTime = null;
  });
  
  // 自动合并所有轨道中的连续音符，并更新UI
  function autoMergeAllNotes() {
    if (!scoreData || !scoreData.track) return;

    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    const gridDuration = (60 / bpm) * 1000 / (beatType / 4);

    const notesByTrack = {};
    // 1. 按轨道颜色分组所有音符
    Object.values(scoreData.track).forEach(note => {
      const color = note.color;
      if (!notesByTrack[color]) {
        notesByTrack[color] = [];
      }
      notesByTrack[color].push(JSON.parse(JSON.stringify(note)));
    });

    const finalTrackObject = {};
    let newNoteIdCounter = 0;

    // 2. 独立处理每个轨道的音符
    for (const trackIndex in notesByTrack) {
      let trackNotes = notesByTrack[trackIndex];
      trackNotes.sort((a, b) => a.time - b.time); // 按时间排序

      if (trackNotes.length === 0) continue;

      let mergedNotesForTrack = [];
      let currentGroup = [trackNotes[0]];

      for (let i = 1; i < trackNotes.length; i++) {
        const prevNoteInGroup = currentGroup[currentGroup.length - 1];
        const currentNote = trackNotes[i];

        // 检查音符是否连续 (允许20%的误差)
        const expectedTime = prevNoteInGroup.time + gridDuration;
        if (Math.abs(currentNote.time - expectedTime) < gridDuration * 0.2) {
          currentGroup.push(currentNote);
        } else {
          // 当前组结束，处理之
          if (currentGroup.length > 1) {
            const firstNote = currentGroup[0];
            const lastNote = currentGroup[currentGroup.length - 1];
            mergedNotesForTrack.push({
              time: firstNote.time,
              type: '2', // 长音符
              color: parseInt(trackIndex),
              begin: firstNote.time,
              end: lastNote.time + gridDuration // 结束于最后一个音符所在格子的末尾
            });
          } else {
            mergedNotesForTrack.push(currentGroup[0]); // 单个音符
          }
          currentGroup = [currentNote]; // 开始新组
        }
      }

      // 处理最后一组
      if (currentGroup.length > 1) {
        const firstNote = currentGroup[0];
        const lastNote = currentGroup[currentGroup.length - 1];
        mergedNotesForTrack.push({
          time: firstNote.time,
          type: '2',
          color: parseInt(trackIndex),
          begin: firstNote.time,
          end: lastNote.time + gridDuration
        });
      } else if (currentGroup.length > 0) {
        mergedNotesForTrack.push(currentGroup[0]);
      }

      // 将处理完的音符添加到最终的谱面对象中
      mergedNotesForTrack.forEach(note => {
        finalTrackObject['note' + (++newNoteIdCounter)] = note;
      });
    }

    // 3. 使用合并后的新数据更新全局谱面
    scoreData.track = finalTrackObject;
    notesCounter = newNoteIdCounter;

    // 4. 根据新的谱面数据，刷新整个编辑器的UI
    updateEditorUIAfterMerge();
  }

  function updateEditorUIAfterMerge() {
    // 首先，清除所有轨道上所有格子的激活状态和样式
    tracks.forEach(track => {
      Array.from(track.children).forEach(grid => {
        grid.classList.remove('active', 'selected', 'long-note');
        delete grid.dataset.noteId;
      });
    });

    // 然后，根据合并后的scoreData重新应用样式
    Object.entries(scoreData.track).forEach(([noteId, noteData]) => {
      const trackElement = tracks[noteData.color];
      if (!trackElement) return;

      const allGrids = Array.from(trackElement.children);
      
      // 为长音符应用样式
      if (noteData.type === '2') {
        allGrids.forEach(grid => {
          const gridTime = parseInt(grid.dataset.time);
          // 检查格子时间是否在长音符的起止时间内
          if (gridTime >= noteData.begin && gridTime < noteData.end) {
            grid.classList.add('active', 'long-note');
            grid.dataset.noteId = noteId;
          }
        });
      } else { // 为短音符应用样式
        const targetGrid = allGrids.find(g => parseInt(g.dataset.time) === noteData.time);
        if (targetGrid) {
          targetGrid.classList.add('active');
          targetGrid.dataset.noteId = noteId;
        }
      }
    });
  }

  // 初始化页面 - 移除实时更新JSON的监听器
  // bpmInput.addEventListener('input', updateJsonPreview);
  // offsetInput.addEventListener('input', updateJsonPreview);
  // difficultyInput.addEventListener('input', updateJsonPreview);
  
  // 初始状态设置
  playBtn.disabled = true;
  pauseBtn.disabled = true;
  saveBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadBtn.style.display = 'none'; // 初始隐藏下载按钮
}); 