import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Image as KonvaImage } from 'react-konva';
import { useKonvaImage } from '../../hooks/useKonvaImage';

function BackgroundImage({ src, width, height, scale }) {
  const image = useKonvaImage(src);
  if (!image) return null;
  return (
    <KonvaImage
      image={image}
      width={width * scale}
      height={height * scale}
      listening={false}
    />
  );
}

export default function MaskCanvas({
  imageUrl,
  dimensions,
  strokes,
  onStrokesChange,
  brushSize,
  tool,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const isDrawing = useRef(false);

  const updateLayout = useCallback(() => {
    if (!containerRef.current || !dimensions.width) return;
    const maxW = containerRef.current.clientWidth;
    const maxH = Math.min(520, window.innerHeight * 0.55);
    const scaleX = maxW / dimensions.width;
    const scaleY = maxH / dimensions.height;
    const s = Math.min(scaleX, scaleY, 1);
    setScale(s);
    setStageSize({
      width: dimensions.width * s,
      height: dimensions.height * s,
    });
  }, [dimensions]);

  useEffect(() => {
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [updateLayout]);

  const toImageCoords = (stageX, stageY) => ({
    x: stageX / scale,
    y: stageY / scale,
  });

  const handlePointerDown = (e) => {
    if (tool === 'pan') return;
    isDrawing.current = true;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const { x, y } = toImageCoords(pos.x, pos.y);
    onStrokesChange([
      ...strokes,
      { tool, points: [x, y], brushSize },
    ]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const { x, y } = toImageCoords(pos.x, pos.y);

    const last = strokes[strokes.length - 1];
    if (!last) return;
    onStrokesChange([
      ...strokes.slice(0, -1),
      { ...last, points: [...last.points, x, y] },
    ]);
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full overflow-hidden rounded-xl border border-surface-border bg-black/40"
    >
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handlePointerDown}
        onMousemove={handlePointerMove}
        onMouseup={handlePointerUp}
        onMouseleave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchmove={handlePointerMove}
        onTouchend={handlePointerUp}
        className="mx-auto touch-none cursor-crosshair"
      >
        <Layer>
          <BackgroundImage
            src={imageUrl}
            width={dimensions.width}
            height={dimensions.height}
            scale={scale}
          />
        </Layer>
        <Layer>
          {strokes.map((stroke, i) => (
            <Line
              key={`stroke-${i}-${stroke.points.length}`}
              points={stroke.points.map((p) => p * scale)}
              stroke={
                stroke.tool === 'eraser'
                  ? 'rgba(0,0,0,1)'
                  : 'rgba(99, 102, 241, 0.7)'
              }
              strokeWidth={stroke.brushSize * scale}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
              tension={0.4}
            />
          ))}
        </Layer>
      </Stage>
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs text-slate-400">
        {dimensions.width} × {dimensions.height}px
      </div>
    </div>
  );
}
