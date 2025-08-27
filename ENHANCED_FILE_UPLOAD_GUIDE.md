# Enhanced File Upload with Camera Capture and PDF Generation

## Overview

The enhanced `FileUpload` component now includes document scanner-like functionality, allowing users to:
- Capture documents directly with their device camera
- Convert multiple camera captures into a single PDF document
- Upload existing files (images, PDFs)
- Generate professional-looking scanned documents

## Features

### 🎥 Camera Capture
- **Real-time camera access** with back camera preference
- **High-resolution capture** (up to 1920x1080)
- **Multiple captures** support for multi-page documents
- **Live preview** of captured images
- **Capture management** with individual removal

### 📄 PDF Generation
- **Automatic PDF creation** from camera captures
- **Professional formatting** with proper margins and centering
- **Timestamp metadata** for each capture
- **Multi-page support** for multiple captures
- **Fallback to individual images** if PDF generation fails

### 📁 File Management
- **Drag & drop** support for existing files
- **Multiple file types** (images, PDFs)
- **File validation** with size and type checks
- **Upload progress** tracking
- **Error handling** with user feedback

## Installation Requirements

### Dependencies
```bash
npm install jspdf
npm install --save-dev @types/jspdf
```

### Browser Compatibility
- **Camera API**: Modern browsers with HTTPS (required for camera access)
- **File API**: All modern browsers
- **Canvas API**: All modern browsers

## Usage

### Basic Implementation
```tsx
import FileUpload from '@/components/inventory/FileUpload'

<FileUpload
  onFileSelect={handleFileSelect}
  acceptedTypes={['image/*', 'application/pdf']}
  multiple={true}
  maxFiles={5}
  maxSize={10} // MB
/>
```

### Camera Capture Workflow
1. **Open Camera**: Click "Abrir Cámara" button
2. **Capture Images**: Use "Capturar" button to take photos
3. **Review Captures**: See thumbnails of all captures
4. **Generate PDF**: Click "Generar PDF" to create document
5. **Upload**: PDF is automatically added to the form

### File Upload Workflow
1. **Drag & Drop**: Drag files onto the upload area
2. **Click to Upload**: Click upload area to select files
3. **Validation**: Files are checked for type and size
4. **Processing**: Files are prepared for upload
5. **Completion**: Files are ready for form submission

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onFileSelect` | `(files: FileList) => void` | Required | Callback when files are selected |
| `acceptedTypes` | `string[]` | `['image/*', 'application/pdf']` | Allowed file types |
| `multiple` | `boolean` | `true` | Allow multiple file selection |
| `maxFiles` | `number` | `5` | Maximum number of files |
| `maxSize` | `number` | `10` | Maximum file size in MB |
| `uploading` | `boolean` | `false` | Show upload state |
| `disabled` | `boolean` | `false` | Disable component |
| `className` | `string` | `undefined` | Additional CSS classes |

## Camera API Integration

### Camera Access
```typescript
const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment', // Back camera
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      } 
    })
    // Handle stream
  } catch (error) {
    // Handle camera access error
  }
}
```

### Image Capture
```typescript
const captureImage = () => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  context.drawImage(video, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.8)
}
```

## PDF Generation

### jsPDF Integration
```typescript
import { jsPDF } from 'jspdf'

const pdf = new jsPDF('p', 'mm', 'a4')
pdf.addImage(imageData, 'JPEG', x, y, width, height)
pdf.addPage()
const blob = pdf.output('blob')
```

### Fallback Strategy
If PDF generation fails, the component automatically falls back to creating individual image files:
1. Convert base64 captures to File objects
2. Add images to the upload queue
3. Maintain camera capture metadata
4. Provide user feedback about fallback

## Error Handling

### Common Issues
- **Camera Access Denied**: User must grant camera permissions
- **PDF Generation Failed**: Automatic fallback to images
- **File Size Exceeded**: Clear error message with size limit
- **Invalid File Type**: File type validation with user feedback

### User Feedback
- **Toast notifications** for success/error states
- **Visual indicators** for file status
- **Progress tracking** for upload operations
- **Clear error messages** with resolution steps

## Styling and Customization

### Default Styling
- **Tailwind CSS** classes for consistent design
- **Responsive layout** for mobile and desktop
- **Accessibility features** with proper ARIA labels
- **Dark mode support** through CSS variables

### Customization Options
```tsx
// Custom styling
<FileUpload className="custom-upload-area" />

// Custom accepted types
<FileUpload acceptedTypes={['application/pdf', 'image/png']} />

// Custom file limits
<FileUpload maxFiles={10} maxSize={25} />
```

## Integration with MaterialEntryForm

The enhanced FileUpload component is fully integrated with the MaterialEntryForm:

### Features
- **Camera captures** are marked with "Cámara" badge
- **PDF generation** creates professional documents
- **File management** integrates with existing upload flow
- **Error handling** provides clear user feedback

### Usage in Form
```tsx
<FileUpload
  onFileSelect={handleFileUpload}
  acceptedTypes={['image/*', 'application/pdf']}
  multiple
  uploading={uploading}
  disabled={loading}
/>
```

## Troubleshooting

### Camera Issues
1. **Check HTTPS**: Camera API requires secure connection
2. **Permissions**: Ensure camera access is granted
3. **Browser Support**: Verify browser supports MediaDevices API
4. **Device Camera**: Check if device has working camera

### PDF Generation Issues
1. **jsPDF Installation**: Verify package is properly installed
2. **Memory**: Large images may cause memory issues
3. **Browser Support**: Some browsers may have limitations
4. **Fallback**: Component automatically falls back to images

### File Upload Issues
1. **File Size**: Check maxSize configuration
2. **File Type**: Verify acceptedTypes configuration
3. **Network**: Check internet connection
4. **Server**: Verify API endpoint availability

## Future Enhancements

### Planned Features
- **OCR Integration**: Extract text from captured documents
- **Image Enhancement**: Auto-correct and improve image quality
- **Batch Processing**: Process multiple documents simultaneously
- **Cloud Storage**: Direct upload to cloud storage services
- **Document Templates**: Pre-defined PDF layouts

### Performance Optimizations
- **Image Compression**: Reduce file sizes before upload
- **Lazy Loading**: Load components only when needed
- **Caching**: Cache generated PDFs for reuse
- **Web Workers**: Offload heavy processing to background threads

## Security Considerations

### Camera Access
- **User Consent**: Always request explicit permission
- **HTTPS Required**: Secure connection mandatory
- **Permission Handling**: Graceful fallback for denied access
- **Data Privacy**: Images processed locally when possible

### File Upload
- **Type Validation**: Strict file type checking
- **Size Limits**: Enforce maximum file sizes
- **Content Scanning**: Scan for malicious content
- **Access Control**: Verify user permissions

## Conclusion

The enhanced FileUpload component provides a comprehensive solution for document capture and management, combining the convenience of camera capture with the professionalism of PDF generation. This creates a document scanner-like experience that improves user workflow and document quality.

For technical support or feature requests, please refer to the project documentation or contact the development team.
