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
  
  // 进度条元素
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const uploadProgressText = document.getElementById('uploadProgressText');
  
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
  
  // 初始化Web Audio API上下文
  function initAudioContext() {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext();
      debugLog('AudioContext初始化成功');
    } catch(e) {
      debugLog('AudioContext初始化失败:', e);
      alert('您的浏览器不支持Web Audio API');
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
      
      // 初始化空白谱面
      initEmptyScore();
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
    
    // 显示JSON预览
    jsonContent.textContent = JSON.stringify(scoreData, null, 2);
    
    // 启用保存按钮
    saveBtn.disabled = false;
    
    // 清空所有音轨
    tracks.forEach(track => track.innerHTML = '');
    selectedNotes = [];
    notesCounter = 0;
    lastSelectedTrack = null;
    lastSelectedTime = null;
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

  // 播放控制
  playBtn.addEventListener('click', function() {
    wavesurfer.play();
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    isPlaying = true;
    
    // 开始更新时间线
    updateEditorTimeline();
  });

  pauseBtn.addEventListener('click', function() {
    wavesurfer.pause();
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    isPlaying = false;
  });

  // 更新编辑器时间线位置
  function updateEditorTimeline() {
    if (!wavesurfer || !isPlaying) return;
    
    const currentTime = wavesurfer.getCurrentTime() * 1000; // 转换为毫秒
    const totalTime = wavesurfer.getDuration() * 1000; // 转换为毫秒
    
    // 计算当前时间对应的格子位置
    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    const gridDuration = (60 / bpm) * 1000 / (beatType / 4);
    
    // 获取第一个轨道的信息
    if (tracks[0] && tracks[0].children.length > 0) {
      const gridWidth = 50; // 格子宽度，与CSS中保持一致
      
      // 计算时间线位置（基于格子数乘以格子宽度）
      const gridPosition = Math.floor(currentTime / gridDuration);
      const position = gridPosition * gridWidth;
      
      // 设置时间线位置
      editorTimeline.style.left = position + 'px';
      
      // 自动滚动确保时间线可见
      const visibleWidth = tracks[0].clientWidth;
      if (position > tracks[0].scrollLeft + visibleWidth * 0.7) {
        tracks.forEach(track => {
          track.scrollLeft = position - visibleWidth * 0.3;
        });
      } else if (position < tracks[0].scrollLeft + visibleWidth * 0.3 && position > visibleWidth * 0.3) {
        tracks.forEach(track => {
          track.scrollLeft = Math.max(0, position - visibleWidth * 0.3);
        });
      }
    }
    
    // 如果仍在播放，继续更新
    if (isPlaying) {
      requestAnimationFrame(updateEditorTimeline);
    }
  }
  
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
    
    // 更新时间线初始位置
    editorTimeline.style.left = '0px';
    
    // 确保轨道可以水平滚动
    tracks.forEach(track => {
      // 双击轨道区域自动滚动到开始位置
      track.addEventListener('dblclick', function() {
        track.scrollLeft = 0;
      });
      
      // 确保滚动条显示
      track.style.overflowX = 'auto';
    });
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
      // 需要处理中间的格子
      const track = tracks[trackIndex];
      const allGrids = Array.from(track.children);
      
      allGrids.forEach(grid => {
        const gridIndex = parseInt(grid.dataset.index);
        if (gridIndex > minIndex && gridIndex < maxIndex) {
          // 中间格子，添加长音符样式
          grid.classList.add('active', 'long-note');
          grid.dataset.noteId = longNoteId;
        }
      });
    }
    
    debugLog(`自动合并了音符 ${currentNote.noteId} 和 ${adjacentNoteId} 为长音符 ${longNoteId}`);
    
    // 重置选中状态
    selectedNotes = [];
  }
  
  // 计算当前格子持续时间
  function calculateGridDuration() {
    const bpm = parseInt(bpmInput.value) || 120;
    const beatType = parseInt(beatInput.value) || 4;
    const beatDuration = (60 / bpm) * 1000;
    return beatDuration / (beatType / 4);
  }
  
  // 自动合并最近的两个音符
  function autoMergeLastNotes() {
    if (selectedNotes.length < 2) return;
    
    // 获取最近两个音符
    const notes = selectedNotes.slice(-2);
    
    // 确保在同一轨道
    if (notes[0].trackIndex !== notes[1].trackIndex) return;
    
    // 按时间排序
    notes.sort((a, b) => a.time - b.time);
    
    // 创建长音符
    const longNoteId = 'note' + (++notesCounter);
    const longNoteData = {
      time: notes[0].time,
      type: '2', // 长音符
      color: notes[0].trackIndex,
      begin: notes[0].time,
      end: notes[1].time + 100 // 结束时间为第二个音符时间+100ms
    };
    
    // 从谱面中移除原有音符
    notes.forEach(note => {
      if (note.noteId) {
        removeNoteFromScore(note.noteId);
      }
    });
    
    // 添加长音符到谱面
    updateScoreWithNote(longNoteId, longNoteData);
    
    // 更新视觉效果
    notes.forEach(note => {
      if (note.element) {
        note.element.classList.add('long-note');
        note.element.dataset.noteId = longNoteId;
      }
    });
    
    // 清空并重置选中状态
    selectedNotes = [];
    
    debugLog('自动合并了两个连续音符');
  }
  
  // 从谱面中移除音符
  function removeNoteFromScore(noteId) {
    if (scoreData && scoreData.track && scoreData.track[noteId]) {
      delete scoreData.track[noteId];
      updateJsonPreview();
    }
  }
  
  // 更新谱面数据
  function updateScoreWithNote(noteId, noteData) {
    if (!scoreData) return;
    
    if (!scoreData.track) {
      scoreData.track = {};
    }
    
    scoreData.track[noteId] = noteData;
    updateJsonPreview();
  }
  
  // 更新JSON预览
  function updateJsonPreview() {
    if (!jsonContent) return;
    jsonContent.textContent = JSON.stringify(scoreData, null, 2);
  }
  
  // 合并音符
  // mergeNotesBtn.addEventListener('click', function() {
  //   if (selectedNotes.length < 2) {
  //     alert('请至少选择两个音符进行合并');
  //     return;
  //   }
    
  //   // 确保选中的音符在同一轨道上
  //   const trackIndex = selectedNotes[0].trackIndex;
  //   const allSameTrack = selectedNotes.every(note => note.trackIndex === trackIndex);
    
  //   if (!allSameTrack) {
  //     alert('只能合并同一轨道上的音符');
  //     return;
  //   }
    
  //   // 按照时间顺序排序
  //   selectedNotes.sort((a, b) => a.time - b.time);
    
  //   // 确保选中的音符是连续的
  //   let isConsecutive = true;
  //   for (let i = 1; i < selectedNotes.length; i++) {
  //     const prevIndex = parseInt(selectedNotes[i-1].index);
  //   }
  // });
  
  // 清空所有按钮
  clearAllBtn.addEventListener('click', function() {
    if (confirm('确定要清空所有音符吗？')) {
      tracks.forEach(track => {
        Array.from(track.children).forEach(grid => {
          // 确保移除所有相关样式
          grid.classList.remove('active', 'selected', 'long-note');
          delete grid.dataset.noteId;
        });
      });
      
      // 清空谱面数据
      if (scoreData) {
        scoreData.track = {};
        updateJsonPreview();
      }
      
      // 重置状态
      selectedNotes = [];
      notesCounter = 0;
      lastSelectedTrack = null;
      lastSelectedTime = null;
    }
  });

  // 保存谱面
  saveBtn.addEventListener('click', function() {
    if (!scoreData) {
      alert('请先上传音乐并创建谱面');
      return;
    }

    // 显示保存中的提示
    saveBtn.textContent = "保存中...";
    saveBtn.disabled = true;
    
    // 在保存前自动合并连续音符
    autoMergeConsecutiveNotes();
    
    debugLog('保存谱面:', scoreData.name);

    fetch('/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scoreData)
    })
    .then(response => {
      debugLog('保存响应状态:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      debugLog('保存响应:', data);
      if (data.success) {
        alert('谱面保存成功!');
        downloadBtn.href = data.downloadUrl;
        downloadBtn.download = data.filename;
        downloadBtn.style.display = 'inline-block';
      } else {
        throw new Error(data.error || '保存失败');
      }
      saveBtn.textContent = "保存谱面";
      saveBtn.disabled = false;
    })
    .catch(error => {
      debugLog('保存错误:', error);
      alert('保存失败: ' + error.message);
      saveBtn.textContent = "保存谱面";
      saveBtn.disabled = false;
    });
  });

  // 自动合并连续的短音符为长音符
  function autoMergeConsecutiveNotes() {
    if (!scoreData || !scoreData.track) return;
    
    debugLog('开始自动合并连续音符...');
    
    // 按轨道和时间排序所有音符
    let notesByTrack = {};
    
    // 整理音符数据，按轨道分组
    for (const [noteId, note] of Object.entries(scoreData.track)) {
      const trackIndex = note.color;
      
      if (!notesByTrack[trackIndex]) {
        notesByTrack[trackIndex] = [];
      }
      
      notesByTrack[trackIndex].push({
        id: noteId,
        ...note
      });
    }
    
    // 处理每条轨道
    for (const [trackIndex, notes] of Object.entries(notesByTrack)) {
      // 按时间排序
      notes.sort((a, b) => a.time - b.time);
      
      // 寻找可以合并的连续短音符组
      let currentGroup = [];
      let mergedNotes = {};
      
      for (let i = 0; i < notes.length; i++) {
        const currentNote = notes[i];
        
        // 只处理短音符(type='1')
        if (currentNote.type !== '1') {
          // 处理前一组
          if (currentGroup.length >= 2) {
            mergeSingleGroup(currentGroup, mergedNotes);
          }
          currentGroup = [];
          continue;
        }
        
        // 初始化或续接当前组
        if (currentGroup.length === 0) {
          currentGroup.push(currentNote);
        } else {
          const prevNote = currentGroup[currentGroup.length - 1];
          
          // 获取当前格子持续时间以作为参考
          const gridDuration = calculateGridDuration();
          const actualGap = currentNote.time - prevNote.time;
          
          // 检查时间是否连续（基于当前节拍设置）
          if (actualGap <= gridDuration * 1.2) {
            // 连续音符，加入当前组
            currentGroup.push(currentNote);
          } else {
            // 不连续，处理前一组并开始新组
            if (currentGroup.length >= 2) {
              mergeSingleGroup(currentGroup, mergedNotes);
            }
            currentGroup = [currentNote];
          }
        }
      }
      
      // 处理最后一组
      if (currentGroup.length >= 2) {
        mergeSingleGroup(currentGroup, mergedNotes);
      }
    }
    
    // 更新JSON预览
    updateJsonPreview();
    
    debugLog('自动合并完成');
  }
  
  // 合并单个音符组
  function mergeSingleGroup(group, mergedNotes) {
    if (group.length < 2) return;
    
    // 获取开始和结束音符
    const firstNote = group[0];
    const lastNote = group[group.length - 1];
    
    // 创建长音符
    const longNoteId = 'note' + (++notesCounter);
    const longNoteData = {
      time: firstNote.time,
      type: '2', // 长音符
      color: firstNote.color,
      begin: firstNote.time,
      end: lastNote.time + (lastNote.end - lastNote.time) // 使用最后一个音符的持续时间
    };
    
    // 从谱面中移除所有组内短音符
    group.forEach(note => {
      delete scoreData.track[note.id];
    });
    
    // 添加新的长音符到谱面
    scoreData.track[longNoteId] = longNoteData;
    
    // 在UI中也反映这个变化 (如果有视觉元素的话)
    updateGridsForMergedNotes(group, longNoteId);
    
    debugLog(`合并了 ${group.length} 个音符为长音符 ${longNoteId}`);
  }
  
  // 更新网格显示合并后的长音符
  function updateGridsForMergedNotes(group, longNoteId) {
    // 获取音符所在的轨道索引
    const trackIndex = group[0].color;
    const track = tracks[trackIndex];
    if (!track) return;
    
    // 查找对应的网格元素
    group.forEach(note => {
      // 查找匹配此音符时间的格子
      const grids = Array.from(track.children);
      const matchingGrid = grids.find(grid => 
        parseInt(grid.dataset.time) === note.time
      );
      
      if (matchingGrid) {
        // 更新视觉效果
        matchingGrid.classList.add('active', 'long-note');
        matchingGrid.dataset.noteId = longNoteId;
      }
    });
  }

  // 初始化WaveSurfer和AudioContext
  initWaveSurfer();
  initAudioContext();
  debugLog('页面初始化完成');
}); 