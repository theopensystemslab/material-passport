'use client'

import Image from 'next/image'
import React, {
  JSX,
  useRef,
  useState
} from 'react'
import { isMobile } from 'react-device-detect'
import { useFormStatus } from 'react-dom'
import Webcam from 'react-webcam'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { addHistoryRecordAction } from '../../actions'

const WEBCAM_WIDTH = 720
const WEBCAM_HEIGHT = 540

interface AddRecordDialogProps {
  componentId: string,
  componentUid: string,
}

export const AddRecordDialog = (
  { componentId, componentUid }: AddRecordDialogProps,
): JSX.Element => {
  return (<Dialog>
    <DialogTrigger asChild>
      <Button
      // we add a custom variant to the shadcn button for this use case
        variant="tertiary"
        className="flex-grow rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg"
      >
        Add a record
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a new record</DialogTitle>
        <DialogDescription>
          Help us document the life of component {componentUid}
        </DialogDescription>
      </DialogHeader>
      <AddRecordForm componentId={componentId} componentUid={componentUid} />
    </DialogContent>
  </Dialog>
  )}

// TODO: capture location as well (via browser API)
const AddRecordForm = (
  { componentId, componentUid }: AddRecordDialogProps,
): JSX.Element => {
  const { pending } = useFormStatus()

  // set up the refs etc. for the manual image capture part of the form (which we may not need, if on mobile)
  // see https://blog.logrocket.com/using-react-webcam-capture-display-images/
  const webcamRef = useRef<Webcam>(null)
  const [photoData, setPhotoData] = useState<string | null>(null)
  const capture = () => {
    if (webcamRef.current) {
      // we mandate a simple 4:3 aspect ratio and relatively low res of 720p for the webcam
      const imageSrc = webcamRef.current.getScreenshot({ width: WEBCAM_WIDTH, height: WEBCAM_HEIGHT })
      setPhotoData(imageSrc)
    }
  }

  // we don't use the shadcn Form setup because latest Next/React seems to offer a simpler approach
  // TODO: enable anyone (on desktop or mobile) to upload a file (i.e. not just use their camera)
  // e.g. could use https://ui-x.junwen-k.dev/docs/components/dropzone
  return (<form 
    // React assumes encType (multipart/form-data) and method (POST) from our use of a server action
    action={addHistoryRecordAction}
    className="flex flex-col space-y-4"
  >
    {/* Include component-specific values as hidden inputs */}
    <input type="hidden" name="componentId" value={componentId} />
    <input type="hidden" name="componentUid" value={componentUid} />
    <div className="flex flex-col space-y-4">
      <label>
        <Textarea
          name="description" 
          rows={3}
          className="border p-2"
          placeholder="Write your notes here..."
        />
      </label>

      {/* on mobile, we can let the browser handle image capture by setting capture to 'environment' */}
      {isMobile ? (
        <label className="flex flex-col space-y-4">
          <p>You can also take a photo for the record:</p>
          <Input 
            type="file" 
            name="photoMobile" 
            accept="image/*"
            capture="environment"
            className="border"
          />
        </label>
      ) : photoData ? (
        <div>
          <Image
            src={photoData}
            alt="Captured"
            className="p-4 rounded"
            width={WEBCAM_WIDTH}
            height={WEBCAM_HEIGHT}
          />
          {/* hidden input to include the captured image in form submission */}
          <input type="hidden" name="photoDesktop" value={photoData} />
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          <p>You can also take a photo for the record:</p>
          <Webcam
            width={WEBCAM_WIDTH}
            height={WEBCAM_HEIGHT}
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/png"
            videoConstraints={{ facingMode: 'environment' }}
            className="rounded border"
          />
          <Button
            type="button"
            variant="outline" 
            onClick={capture}
            className="rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg"
          >
            Take photo
          </Button>
        </div>
      )}

      {/* TODO: harden config here so you can't submit same data multiple times */}
      <Button 
        type="submit" 
        disabled={pending} 
        className="rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg"
      >
        {pending ? 'Submitting...' : 'Submit'}
      </Button>
    </div>
  </form>)
}
