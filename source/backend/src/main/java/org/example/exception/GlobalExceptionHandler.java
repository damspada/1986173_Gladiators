package org.example.exception;

import org.example.dto.ErrorDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorDto handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return new ErrorDto("BAD_REQUEST",
                "Invalid value for parameter '%s': %s".formatted(e.getName(), e.getValue()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorDto handleIllegalArgument(IllegalArgumentException e) {
        return new ErrorDto("BAD_REQUEST", e.getMessage());
    }
}

